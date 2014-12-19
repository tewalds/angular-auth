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
			data: { authorizedRoles: [USER_ROLES.user] }
		})
		.state('private', {
			url: '/private',
			templateUrl: 'home.html',
			controller: 'PrivateCtrl',
			data: { authorizedRoles: [USER_ROLES.user] }
		})
		.state('admin', {
			url: '/admin',
			templateUrl: 'home.html',
			controller: 'AdminCtrl',
			data: { authorizedRoles: [USER_ROLES.admin] }
		});
		$urlRouterProvider
		.otherwise('/');
	}
)
.controller('HomeCtrl',
	function($scope, $resource) {
		console.log("HomeCtrl");
		$scope.state = $resource('/api/home').get()
	}
)
.controller('SignupCtrl',
	function($scope, $resource) {
		console.log("SignupCtrl");
	}
)
.controller('PrivateCtrl',
	function($scope, $resource) {
		console.log("PrivateCtrl");
		$scope.state = $resource('/api/private').get()
	}
)
.controller('AdminCtrl',
	function($scope, $resource) {
		console.log("AdminCtrl");
		$scope.state = $resource('/api/admin').get()
	}
);



