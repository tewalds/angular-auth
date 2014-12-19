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
		all: '',
		anon: 'anon',
		user: 'user',
		admin: 'admin',
	})
	.controller('LoginController', function($scope, $rootScope, AUTH_EVENTS, AuthService) {
		console.log("LoginCtrl");
		$scope.credentials = {
			email: '',
			password: '',
		};
		$scope.action = 'Login';
		$scope.loginError = '';

		$scope.auth = function(action, credentials) {
			AuthService.auth(action, credentials).then(function(user) {
				$rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
			}, function(res) {
				$rootScope.$broadcast(AUTH_EVENTS.loginFailed);
				$scope.loginError = res.data.Error;
			});
		};
		$scope.clearError = function() { $scope.loginError = ""; };
	})
	.factory('AuthService', function($http, $rootScope, Session, AUTH_EVENTS) {
		var authService = {};

		authService.auth = function(action, credentials) {
			var url = (action == 'Login' ? 'login' :
				      (action == 'Sign up' ? 'signup' :
				       "forgot"))
			return $http
				.post('/api/' + url, credentials)
				.then(function(res) {
					Session.create(res.data);
					return res.data;
				});
		};

		authService.ping = function() {
			return $http
				.get('/api/me')
				.then(function(res) {
					Session.create(res.data);
					if (!!Session.userId) {
					//	$rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
					}
					return res.data;
				});
		};

		authService.logout = function() {
			return $http
				.post('/api/logout')
				.then(function(res) {
					Session.destroy();
					$rootScope.$broadcast(AUTH_EVENTS.logoutSuccess);
					return res.data;
				});
		}

		authService.isAuthenticated = function() {
			return !!Session.userId;
		};

		authService.isAuthorized = function(authorizedRoles) {
//			console.log("authorizedRoles: ", authorizedRoles, "Session.userRole:", Session.userRole)
			if (authorizedRoles === null || authorizedRoles === undefined) {
				return true;
			}
			if (!angular.isArray(authorizedRoles)) {
				authorizedRoles = [authorizedRoles];
			}
			return (authorizedRoles.length == 0 || authorizedRoles.indexOf(Session.userRole) !== -1);
		};

		return authService;
	})
	.service('Session', function() {
		this.create = function(user) {
			this.userId = user.Id;
			this.userRole = user.Role;
		};
		this.destroy = function() {
			this.userId = 0;
			this.userRole = 'anon';
		};
		return this;
	})
	.controller('ApplicationController', function($scope, $http, USER_ROLES, AuthService, Session) {
		console.log("ApplicationController enter: ", arguments);
		console.log("session: ", Session)
		$scope.currentUser = Session;
		$scope.userRoles = USER_ROLES;
		$scope.isAuthorized = AuthService.isAuthorized;
		$scope.logout = AuthService.logout;
	})
	.run(function($rootScope, AUTH_EVENTS, AuthService, Session, $http) {
		$rootScope.$on('$stateChangeStart', function(event, next) {
			console.log("stateChangeStart", arguments);
			console.log("event", event);
			console.log("next", next);

			// move this to a decorator?
			next.resolve = angular.extend(next.resolve, {
				session: function (authService) {
					if (Session.userRoles === undefined) {
						return authService.ping();
					} else {
						return Session;
					}
				},
				auth: function (session) {
//					return a promise that waits for login to succeed...
				}
			})

			var authorizedRoles = next.data && next.data.authorizedRoles;
			console.log("authorizedRoles", authorizedRoles);
			console.log("Session: ", Session)
			if (!AuthService.isAuthorized(authorizedRoles)) {
				console.log("!AuthService.isAuthorized")
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
		$rootScope.$on('$stateChangeError', function(event, toState, toParams, fromState, fromParams, error){
			console.log("$stateChangeError: ", arguments);
		});
		AuthService.ping();
	})
	.config(function($httpProvider, $stateProvider) {
		$httpProvider.interceptors.push([
			'$injector',
			function($injector) {
				return $injector.get('AuthInterceptor');
			}
		]);
		// Need access to both state representations. Decorate any attribute to access private state object.
		$stateProvider.decorator('path', function(state, parentFn) {
			if (state.self.resolve === undefined) {
				state.self.resolve = {};
				state.resolve = state.self.resolve;
			}
			return parentFn(state);
		});
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
			restrict: 'E',
			template: '<div ng-if="visible" ng-include="\'login.html\'">',
			link: function(scope) {
				var showDialog = function() {
					scope.visible = true;
				};
				var hideDialog = function() {
					scope.visible = false;
				};

				scope.visible = false;
				scope.$on(AUTH_EVENTS.notAuthenticated, showDialog);
				scope.$on(AUTH_EVENTS.sessionTimeout, showDialog)
				scope.$on(AUTH_EVENTS.loginSuccess, hideDialog)
			}
		};
	})
	.directive('roles', function(ngIfDirective, AuthService) {
		var ngIf = ngIfDirective[0];
		return {
			transclude: ngIf.transclude,
			priority: ngIf.priority,
			terminal: ngIf.terminal,
			restrict: ngIf.restrict,
			link: function($scope, $element, $attr) {
				$attr.ngIf = function() {
					return AuthService.isAuthorized($attr['roles']);
				};
				ngIf.link.apply(ngIf, arguments);
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