var authApp = angular.module('authApp', [
	'ui.router',
	'auth',
	'ngResource',
])
.config(
	function($stateProvider, $urlRouterProvider, USER_ROLES) {
		$stateProvider
		.state('home', {
			url: '/',
			templateUrl: 'home.html',
			controller: 'HomeCtrl',
//			data: { authorizedRoles: [] }
		})
		.state('signup', {
			url: '/signup',
			templateUrl: 'signup.html',
			controller: 'SignupCtrl',
			data: { authorizedRoles: [USER_ROLES.anon] }
		})
		.state('private', {
			url: '/private',
			templateUrl: 'private.html',
			controller: 'PrivateCtrl',
			data: { authorizedRoles: [USER_ROLES.all] }
		});
	}
)
.controller('HomeCtrl',
	function($scope, AuthService, Session) {
		console.log("HomeCtrl");
	}
)
.controller('SignupCtrl',
	function($scope, AuthService, Session) {
		console.log("SignupCtrl");

	}
)
.controller('PrivateCtrl',
	function($scope, AuthService, Session) {
		console.log("PrivateCtrl");
	}
);



