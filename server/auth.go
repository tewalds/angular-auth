package main

import (
	"fmt"
	"github.com/ant0ine/go-json-rest/rest"
	"log"
	"math/rand"
	"net/http"
	"net/mail"
	"time"
)

type AuthHandlerFunc func(rest.ResponseWriter, *rest.Request, User)

type User struct {
	Id       int64
	Email    string
	Password string
	Role     string
}

type Session struct {
	UserId    int64
	SessionId int64
	CreatedAt time.Time
	Expiry    time.Time
}

func (this *Session) name() string {
	return fmt.Sprintf("%X:%X", this.UserId, this.SessionId)
}

const cookieName = "session"

var (
	auth       SessionAuth
	nextUserId int64
	users      map[int64]User
	emails     map[string]int64
	sessions   map[string]Session
)

func init() {
	auth = SessionAuth{}
	nextUserId = 1
	users = make(map[int64]User)
	emails = make(map[string]int64)
	sessions = make(map[string]Session)

	api := rest.ResourceHandler{
	//		EnableRelaxedContentType: true,
	}
	err := api.SetRoutes(
		&rest.Route{"POST", "/signup", auth.Anon(Signup)},
		&rest.Route{"POST", "/login", auth.Anon(Login)},
		&rest.Route{"POST", "/forgot", auth.Anon(Forgot)},
		&rest.Route{"POST", "/logout", auth.Required(Logout)},
		&rest.Route{"GET", "/me", auth.Optional(GetMe)},
		&rest.Route{"GET", "/home", auth.Optional(Home)},
		&rest.Route{"GET", "/private", auth.Required(Private)},
		&rest.Route{"GET", "/admin", auth.Admin(Admin)},
	)
	if err != nil {
		log.Fatal(err)
	}

	http.Handle("/", http.FileServer(http.Dir("../app/")))
	http.Handle("/api/", http.StripPrefix("/api", &api))
}

type SessionAuth struct{}
type AuthRequired int

const (
	AUTH_ANON     AuthRequired = iota
	AUTH_OPTIONAL AuthRequired = iota
	AUTH_REQUIRED AuthRequired = iota
	AUTH_ADMIN    AuthRequired = iota
)

func (this *SessionAuth) MiddlewareFunc(handler rest.HandlerFunc) rest.HandlerFunc {
	return this.Required(func(w rest.ResponseWriter, r *rest.Request, u User) {
		handler(w, r)
	})
}

func (this *SessionAuth) Anon(handler AuthHandlerFunc) rest.HandlerFunc {
	return func(w rest.ResponseWriter, r *rest.Request) {
		this.authWrapper(handler, w, r, AUTH_ANON)
	}
}
func (this *SessionAuth) Optional(handler AuthHandlerFunc) rest.HandlerFunc {
	return func(w rest.ResponseWriter, r *rest.Request) {
		this.authWrapper(handler, w, r, AUTH_OPTIONAL)
	}
}
func (this *SessionAuth) Required(handler AuthHandlerFunc) rest.HandlerFunc {
	return func(w rest.ResponseWriter, r *rest.Request) {
		this.authWrapper(handler, w, r, AUTH_REQUIRED)
	}
}
func (this *SessionAuth) Admin(handler AuthHandlerFunc) rest.HandlerFunc {
	return func(w rest.ResponseWriter, r *rest.Request) {
		this.authWrapper(handler, w, r, AUTH_ADMIN)
	}
}

func (this *SessionAuth) authWrapper(handler AuthHandlerFunc, w rest.ResponseWriter, r *rest.Request, required AuthRequired) {
	if session := this.getSession(r); session != nil {
		if required == AUTH_ANON {
			rest.Error(w, "Must not be logged in.", http.StatusUnauthorized)
			return
		}
		if session.CreatedAt.Before(time.Now().Add(-time.Hour * 24)) {
			delete(sessions, session.name())
			this.NewSession(w, session.UserId)
		}
		user := users[session.UserId]

		if required == AUTH_ADMIN && user.Role != "admin" {
			rest.Error(w, "Must be an admin.", http.StatusUnauthorized)
			return
		}

		user.Password = ""
		handler(w, r, user)
		return
	}

	if required == AUTH_ANON || required == AUTH_OPTIONAL {
		handler(w, r, User{Role: "anon"})
		return
	}

	rest.Error(w, "Unauthorized", http.StatusUnauthorized)
	return
}

func (this *SessionAuth) getSession(r *rest.Request) *Session {
	cookie, err := r.Request.Cookie(cookieName)
	if err != nil || cookie.Value == "" {
		return nil
	}
	if session, ok := sessions[cookie.Value]; ok {
		if session.Expiry.After(time.Now()) {
			return &session
		}
		delete(sessions, cookie.Value)
	}
	return nil
}

func (this *SessionAuth) NewSession(w rest.ResponseWriter, userid int64) {
	var session = Session{
		UserId:    userid,
		SessionId: rand.Int63(),
		CreatedAt: time.Now(),
		Expiry:    time.Now().Add(time.Hour * 24 * 30),
	}
	var name = session.name()
	sessions[name] = session

	http.SetCookie(w.(http.ResponseWriter), &http.Cookie{
		Name:     cookieName,
		Value:    name,
		Path:     "/",
		MaxAge:   int(session.Expiry.Unix() - session.CreatedAt.Unix()),
		HttpOnly: true,
	})
}

func (this *SessionAuth) DestroySession(w rest.ResponseWriter, session *Session) {
	log.Print("deleting session")
	var name = session.name()
	delete(sessions, name)

	log.Print("Setting expired cookie")
	http.SetCookie(w.(http.ResponseWriter), &http.Cookie{
		Name:   cookieName,
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})
}

func GetMe(w rest.ResponseWriter, r *rest.Request, u User) {
	w.WriteJson(u)
}

type Credentials struct {
	Email    string `json:email`
	Password string `json:password`
}

func Login(w rest.ResponseWriter, r *rest.Request, u User) {
	if u.Id == 0 {
		credentials := Credentials{}
		if err := r.DecodeJsonPayload(&credentials); err != nil {
			rest.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		userid, ok := emails[credentials.Email]
		if !ok {
			rest.Error(w, "User doesn't exist", http.StatusUnauthorized)
			return
		}
		u = users[userid]
		if u.Email != credentials.Email || u.Password != credentials.Password {
			rest.Error(w, "Bad password", http.StatusUnauthorized)
			return
		}
		u.Password = ""

		auth.NewSession(w, u.Id)
	}
	w.WriteJson(u)
}

func Signup(w rest.ResponseWriter, r *rest.Request, u User) {
	if u.Id == 0 {
		credentials := Credentials{}
		if err := r.DecodeJsonPayload(&credentials); err != nil {
			rest.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if address, err := mail.ParseAddress(credentials.Email); err != nil || credentials.Email != address.Address {
			rest.Error(w, "Bad email address.", http.StatusForbidden)
			return
		}

		if _, ok := emails[credentials.Email]; ok {
			rest.Error(w, "User already exists", http.StatusForbidden)
			return
		}

		u = User{
			Id:       nextUserId,
			Email:    credentials.Email,
			Password: credentials.Password,
			Role:     "user",
		}
		nextUserId += 1
		users[u.Id] = u
		emails[u.Email] = u.Id
		u.Password = ""
		auth.NewSession(w, u.Id)
	}
	w.WriteJson(u)
}

func Logout(w rest.ResponseWriter, r *rest.Request, u User) {
	if session := auth.getSession(r); session != nil {
		auth.DestroySession(w, session)
	}
	w.WriteJson(User{Role: "anon"})
}

func Forgot(w rest.ResponseWriter, r *rest.Request, u User) {
	if u.Id != 0 {
		rest.Error(w, "Already logged in", http.StatusBadRequest)
		return
	}

	credentials := Credentials{}
	if err := r.DecodeJsonPayload(&credentials); err != nil {
		rest.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if address, err := mail.ParseAddress(credentials.Email); err != nil || credentials.Email != address.Address {
		rest.Error(w, "Bad email address.", http.StatusForbidden)
		return
	}

	if _, ok := emails[credentials.Email]; !ok {
		rest.Error(w, "User doesn't exist", http.StatusForbidden)
		return
	}
	// TODO: Send recovery email
	rest.Error(w, "Recovery email sent", http.StatusUnauthorized)
	return
}

type State struct {
	State string
}

func Home(w rest.ResponseWriter, r *rest.Request, u User) {
	w.WriteJson(State{"home"})
}

func Private(w rest.ResponseWriter, r *rest.Request, u User) {
	w.WriteJson(State{"private"})
}

func Admin(w rest.ResponseWriter, r *rest.Request, u User) {
	w.WriteJson(State{"admin"})
}

func main() {
	log.Println("Listening...")
	http.ListenAndServe(":8081", nil)
}
