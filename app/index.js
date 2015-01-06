var authApp = angular.module('authApp', [
		'ui.router',
		'auth',
		'ngResource',
	])
	.config(
		function($stateProvider, $urlRouterProvider, AuthLevels) {
			// Public routes
			$stateProvider
				.state('site', {
					abstract: true,
					template: "<ui-view/>",
					data: {
						access: AuthLevels.public
					},
				})
				.state('public', {
					parent: 'site',
					abstract: true,
					template: "<ui-view/>",
					data: {
						access: AuthLevels.public
					}
				})
				.state('public.public', {
					url: '/public',
					controller: 'PublicCtrl',
					templateUrl: 'home.html'
				})
				.state('public.publiclocal', {
					url: '/publiclocal',
					controller: 'PublicLocalCtrl',
					templateUrl: 'home.html'
				})
				.state('404', {
					parent: 'public',
					url: '/404',
					templateUrl: '404.html'
				})
				.state('403', {
					parent: 'public',
					url: '/403',
					templateUrl: '403.html'
				});
			// Anonymous routes
			$stateProvider
				.state('anon', {
					parent: 'site',
					abstract: true,
					template: "<ui-view/>",
					data: {
						access: AuthLevels.anon
					}
				})
				.state('login', {
					parent: 'anon',
					url: '/login',
					templateUrl: 'login.html',
					controller: 'LoginController'
				})
				.state('anon.anon', {
					url: '/anon',
					controller: 'AnonCtrl',
					templateUrl: 'home.html'
				})
				.state('anon.anonlocal', {
					url: '/anonlocal',
					controller: 'AnonLocalCtrl',
					templateUrl: 'home.html'
				});
			// Regular user routes
			$stateProvider
				.state('user', {
					parent: 'site',
					abstract: true,
					template: "<ui-view/>",
					data: {
						access: AuthLevels.user
					}
				})
				.state('home', {
					parent: 'user',
					url: '/',
					templateUrl: 'home.html',
					controller: 'HomeCtrl',
				})
				.state('user.private', {
					url: '/private',
					controller: 'PrivateCtrl',
					templateUrl: 'home.html'
				})
				.state('user.privatelocal', {
					url: '/privatelocal',
					controller: 'PrivateLocalCtrl',
					templateUrl: 'home.html'
				});
			// Admin routes
			$stateProvider
				.state('admin', {
					parent: 'site',
					abstract: true,
					template: "<ui-view/>",
					data: {
						access: AuthLevels.admin
					}
				})
				.state('admin.admin', {
					url: '/admin',
					templateUrl: 'home.html',
					controller: 'AdminCtrl'
				})
				.state('admin.adminlocal', {
					url: '/adminlocal',
					templateUrl: 'home.html',
					controller: 'AdminLocalCtrl'
				});

			$urlRouterProvider.otherwise('/');
		}
	)
	.controller('ApplicationController', function($scope, Auth) {
		console.log("ApplicationController enter: ", arguments);
		$scope.currentUser = Auth.user;
		$scope.logout = Auth.logout;
	})
	.controller('HomeCtrl',
		function($scope, $resource) {
			console.log("HomeCtrl");
			$scope.state = {state: "Home"};
		}
	)
	.controller('PublicCtrl',
		function($scope, $resource) {
			console.log("PublicCtrl");
			$scope.state = $resource('/api/public').get()
		}
	)
	.controller('PublicLocalCtrl',
		function($scope, $resource) {
			console.log("PublicLocalCtrl");
			$scope.state = {state: "local public"}
		}
	)
	.controller('AnonCtrl',
		function($scope, $resource) {
			console.log("AnonCtrl");
			$scope.state = $resource('/api/anon').get()
		}
	)
	.controller('AnonLocalCtrl',
		function($scope, $resource) {
			console.log("AnonLocalCtrl");
			$scope.state = {state: "local anon"}
		}
	)
	.controller('PrivateCtrl',
		function($scope, $resource) {
			console.log("PrivateCtrl");
			$scope.state = $resource('/api/private').get()
		}
	)
	.controller('PrivateLocalCtrl',
		function($scope, $resource) {
			console.log("PrivateLocalCtrl");
			$scope.state = {state: "local private"}
		}
	)
	.controller('AdminCtrl',
		function($scope, $resource) {
			console.log("AdminCtrl");
			$scope.state = $resource('/api/admin').get()
		}
	)
	.controller('AdminLocalCtrl',
		function($scope, $resource) {
			console.log("AdminLocalCtrl");
			$scope.state = {state: "local admin"}
		}
	);