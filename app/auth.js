var auth = angular.module('auth', [
	'ui.router'
]);

auth
	.constant('AUTH_EVENTS', {
		loginSuccess: 'auth-login-success',
		loginFailed: 'auth-login-failed',
		logoutSuccess: 'auth-logout-success',
		sessionTimeout: 'auth-session-timeout',
		notAuthenticated: 'auth-not-authenticated',
		notAuthorized: 'auth-not-authorized'
	})
	.constant('USER_ROLES', {
		all: '*',
		admin: 'admin',
		user: 'user',
		anon: 'anon'
	})
	.controller('LoginController', function($scope, $rootScope, AUTH_EVENTS, AuthService) {
		console.log("LoginCtrl");
		$scope.credentials = {
			email: '',
			password: '',
		};
		$scope.action = 'Login';

		$scope.auth = function(action, credentials) {
			AuthService.auth(action, credentials).then(function(user) {
				$rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
				$scope.setCurrentUser(user);
			}, function() {
				$rootScope.$broadcast(AUTH_EVENTS.loginFailed);
			});
		};
	})
	.factory('AuthService', function($http, Session) {
		var authService = {};

		authService.auth = function(action, credentials) {
			console.log("auth", credentials)
			console.log(action)
			var url = (action == 'Login' ? 'login' :
				      (action == 'Sign up' ? 'signup' :
				       "forgot"))
			return $http
				.post('/api/' + url, credentials)
				.then(function(res) {
					Session.create(res.data.Id, res.data.Role);
					return res.data;
				});
		};

		authService.isAuthenticated = function() {
			return !!Session.userId;
		};

		authService.isAuthorized = function(authorizedRoles) {
			if (authorizedRoles === null || authorizedRoles === undefined) {
				return true;
			}
			if (!angular.isArray(authorizedRoles)) {
				authorizedRoles = [authorizedRoles];
			}
			return (authorizedRoles.length == 0 || 
				(authService.isAuthenticated() &&
				authorizedRoles.indexOf(Session.userRole) !== -1));
		};

		return authService;
	})
	.service('Session', function() {
		this.create = function(userId, userRole) {
			this.userId = userId;
			this.userRole = userRole;
		};
		this.destroy = function() {
			this.userId = null;
			this.userRole = null;
		};
		return this;
	})
	.controller('ApplicationController', function($scope, USER_ROLES, AuthService) {
		$scope.currentUser = null;
		$scope.userRoles = USER_ROLES;
		$scope.isAuthorized = AuthService.isAuthorized;
		$scope.isLoginPage = false;

		$scope.setCurrentUser = function(user) {
			$scope.currentUser = user;
		};
	})
	.run(function($rootScope, AUTH_EVENTS, AuthService) {
		$rootScope.$on('$stateChangeStart', function(event, next) {
			console.log("stateChangeStart");
			console.log("event", event);
			console.log("next", next);
			var authorizedRoles = next.data && next.data.authorizedRoles;
			console.log("authorizedRoles", authorizedRoles);
			if (!AuthService.isAuthorized(authorizedRoles)) {
				event.preventDefault();
				if (AuthService.isAuthenticated()) {
					// user is not allowed
					console.log("Not authorized");
					$rootScope.$broadcast(AUTH_EVENTS.notAuthorized);
				} else {
					console.log("Not authenticated");
					// user is not logged in
					$rootScope.$broadcast(AUTH_EVENTS.notAuthenticated);
				}
			}
		});
	})
	.config(function($httpProvider) {
		$httpProvider.interceptors.push([
			'$injector',
			function($injector) {
				return $injector.get('AuthInterceptor');
			}
		]);
	})
	.factory('AuthInterceptor', function($rootScope, $q, AUTH_EVENTS) {
		return {
			responseError: function(response) {
				$rootScope.$broadcast({
					401: AUTH_EVENTS.notAuthenticated,
					403: AUTH_EVENTS.notAuthorized,
					419: AUTH_EVENTS.sessionTimeout,
					440: AUTH_EVENTS.sessionTimeout
				}[response.status], response);
				return $q.reject(response);
			}
		};
	})
	.directive('loginDialog', function(AUTH_EVENTS) {
		return {
			restrict: 'A',
			template: '<div ng-if="visible" ng-include="\'login.html\'">',
			link: function(scope) {
				var showDialog = function() {
					scope.visible = true;
				};

				scope.visible = false;
				scope.$on(AUTH_EVENTS.notAuthenticated, showDialog);
				scope.$on(AUTH_EVENTS.sessionTimeout, showDialog)
			}
		};
	});
/*	.directive('formAutofillFix', function($timeout) {
		return function(scope, element, attrs) {
			element.prop('method', 'post');
			if (attrs.ngSubmit) {
				$timeout(function() {
					element
						.unbind('submit')
						.bind('submit', function(event) {
							event.preventDefault();
							console.log("element", element)
							console.log("element.find", element.find('input, textarea, select'))
							element
								.find('input, textarea, select')
								.trigger('input')
								.trigger('change')
								.trigger('keydown');
							scope.$apply(attrs.ngSubmit);
						});
				});
			}
		};
	});
	*/