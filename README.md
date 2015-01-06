angular-auth
============

This is an AngularJS authentication demo.


Backend
-------
There's a backend written in Go that tracks users and sessions. It uses cookies with simple session ids to track sessions. It has a dependency on [github.com/ant0ine/go-json-rest/rest](https://github.com/ant0ine/go-json-rest). 

To run the backend:
    angular-auth $ cd server
    angular-auth/server $ go run auth.go

Frontend
--------
The front end is in angular. It defines several routes with different visibilities, and an auth system to enforce them. All the magic happens in a resolve that is added to all routes. The resolve will check the user's session state before the state transition happens, asking the server for the user's information if it isn't already known, and sending the user to a login page if it's not authenticated. There's also an httpProvider hook that will clear the user's session if any request fails, forcing a login if that makes sense.
