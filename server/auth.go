package main

import (
	"io/ioutil"
	"log"
	"net/http"
	"time"

	"github.com/ant0ine/go-json-rest/rest"
	jwt "github.com/dgrijalva/jwt-go"
)

// location of the files used for signing and verification
const (
	privKeyPath = "keys/app.rsa"     // openssl genrsa -out app.rsa keysize
	pubKeyPath  = "keys/app.rsa.pub" // openssl rsa -in app.rsa -pubout > app.rsa.pub
)
const tokenName = "token"

type AuthHandlerFunc func(rest.ResponseWriter, *rest.Request, User)

type User struct {
	Id       int64
	Email    string
	Password string
	Role     string
}

var (
	auth       TokenAuth
	nextUserId int64
	users      map[int64]User
	emails     map[string]int64
)

func init() {
	auth = TokenAuth{}
	auth.loadKeys()
	nextUserId = 1
	users = make(map[int64]User)
	emails = make(map[string]int64)

	api := rest.ResourceHandler{
	//		EnableRelaxedContentType: true,
	}
	err := api.SetRoutes(
		&rest.Route{"POST", "/signup", auth.Optional(Signup)},
		&rest.Route{"POST", "/login", auth.Optional(Login)},
		&rest.Route{"GET", "/me", auth.Optional(GetMe)},
		&rest.Route{"GET", "/private", auth.Required(GetMe)},
	)
	if err != nil {
		log.Fatal(err)
	}

	http.Handle("/", http.FileServer(http.Dir("app/")))
	http.Handle("/api/", http.StripPrefix("/api", &api))
}

type TokenAuth struct {
	verifyKey, signKey []byte
}

func (ta *TokenAuth) loadKeys() {
	var err error

	ta.signKey, err = ioutil.ReadFile(privKeyPath)
	if err != nil {
		log.Fatal("Error reading private key")
		return
	}

	ta.verifyKey, err = ioutil.ReadFile(pubKeyPath)
	if err != nil {
		log.Fatal("Error reading private key")
		return
	}
}

func (ta *TokenAuth) MiddlewareFunc(handler rest.HandlerFunc) rest.HandlerFunc {
	return ta.Required(func(w rest.ResponseWriter, r *rest.Request, u User) {
		handler(w, r)
	})
}

func (ta *TokenAuth) Required(handler AuthHandlerFunc) rest.HandlerFunc {
	return func(w rest.ResponseWriter, r *rest.Request) {
		ta.authWrapper(handler, w, r, true)
	}
}
func (ta *TokenAuth) Optional(handler AuthHandlerFunc) rest.HandlerFunc {
	return func(w rest.ResponseWriter, r *rest.Request) {
		ta.authWrapper(handler, w, r, false)
	}
}
func (ta *TokenAuth) authWrapper(handler AuthHandlerFunc, w rest.ResponseWriter, r *rest.Request, required bool) {
	token, err := ta.Validate(r)
	if err == nil && token.Valid {
		if token.Claims["iss"].(int64) < time.Now().Add(-time.Hour*24).Unix() {
			ta.Refresh(w, token.Claims["usr"].(int64))
		}
		user := users[token.Claims["usr"].(int64)]
		user.Password = ""
		handler(w, r, user)
		return
	}

	if !required {
		handler(w, r, User{})
		return
	}

	if err == http.ErrNoCookie {
		rest.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	/*
		if err.(type) == *jwt.ValidationError {
			vErr := err.(*jwt.ValidationError)
			if vErr.Errors == jwt.ValidationErrorExpired {
				rest.Error(w, "Authentication Timeout", 419)
				return
			}
		}
	*/
	rest.Error(w, err.Error(), http.StatusUnauthorized)
	return
}

func (ta *TokenAuth) Validate(r *rest.Request) (*jwt.Token, error) {
	tokenCookie, err := r.Request.Cookie(tokenName)
	if err != nil {
		return nil, err
	}

	if tokenCookie.Value == "" {
		return nil, http.ErrNoCookie
	}

	return jwt.Parse(tokenCookie.Value, func(token *jwt.Token) (interface{}, error) {
		return ta.verifyKey, nil
	})
}

func (ta *TokenAuth) Refresh(w rest.ResponseWriter, userid int64) {
	t := jwt.New(jwt.GetSigningMethod("RS256"))
	t.Claims["usr"] = userid
	t.Claims["iss"] = time.Now().Unix()
	t.Claims["exp"] = time.Now().Add(time.Hour * 24 * 30).Unix()
	tokenString, err := t.SignedString(ta.signKey)
	if err != nil {
		rest.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	http.SetCookie(w.(http.ResponseWriter), &http.Cookie{
		Name:       tokenName,
		Value:      tokenString,
		Path:       "/",
		RawExpires: "0",
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
		err := r.DecodeJsonPayload(&credentials)
		if err != nil {
			rest.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		userid := emails[credentials.Email]
		if userid == 0 {
			rest.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		u = users[userid]
		if u.Email != credentials.Email || u.Password != credentials.Password {
			rest.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		u.Password = ""

		auth.Refresh(w, u.Id)
	}
	w.WriteJson(u)
}

func Signup(w rest.ResponseWriter, r *rest.Request, u User) {
	if u.Id == 0 {
		credentials := Credentials{}
		err := r.DecodeJsonPayload(&credentials)
		if err != nil {
			rest.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		userid := emails[credentials.Email]
		if userid != 0 {
			rest.Error(w, err.Error(), http.StatusForbidden)
			return
		}

		u = User{
			Id:       nextUserId,
			Email:    credentials.Email,
			Password: credentials.Password,
			Role:     "",
		}
		nextUserId += 1
		users[u.Id] = u
		emails[u.Email] = u.Id
		u.Password = ""
		auth.Refresh(w, u.Id)
	}
	w.WriteJson(u)
}

func main() {
	log.Println("Listening...")
	http.ListenAndServe(":8081", nil)
}
