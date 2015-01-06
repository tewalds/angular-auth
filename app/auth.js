angular.module('auth', [
	'ui.router'
])
	.constant('AuthLevels', {
		public: 'public',
		anon: 'anon',
		user: 'user',
		admin: 'admin',
	})
	.controller('LoginController', function($scope, $rootScope, $state, Auth) {
		console.log("LoginCtrl");
		$scope.credentials = {
			email: '',
			password: '',
		};
		$scope.action = 'Login';
		$scope.loginError = '';

		$scope.auth = function(action, credentials) {
			Auth.auth(action, credentials).then(function(user) {
				if (Auth.isAuthenticated()){
					if ($scope.returnToState) {
						$state.go($scope.returnToState.name, $scope.returnToStateParams);
					} else {
						$state.go('home');
					}
				}
			}, function(res) {
				$scope.loginError = res.data.Error;
			});
		};
		$scope.clearError = function() { $scope.loginError = ""; };
	})
	.factory('Session', function() {
		var user = {};
		return {
			user: user,
			setUser: function(u) { return angular.extend(user, u); },
			userSet: function() { return (Object.getOwnPropertyNames(user).length > 0); },
			clear: function() {
				for (k in user) {
					if (user.hasOwnProperty(k)) {
						delete user[k];
					}
				}
				return user;
			},
		};
	})
	.factory('Auth', function($http, $rootScope, $state, $q, Session, AuthLevels) {
		var Auth = {
			auth: function(action, credentials) {
				// Either login, signup or send a password reminder email.
				var url = (action == 'Login' ? 'login' :
						  (action == 'Sign up' ? 'signup' :
						   "forgot"))
				return $http
					.post('/api/' + url, credentials)
					.then(function(res) { return Session.setUser(res.data); } /*,
						  function() { return Session.clear(); }*/);
			},
			ping: function() {
				return $http
					.get('/api/me')
					.then(function(res) { return Session.setUser(res.data); },
						  function() { return Session.clear(); });
			},
			logout: function() {
				return $http
					.post('/api/logout')
					.then(function(res) { return Session.setUser(res.data); },
						  function() { return Session.clear(); });
			},

			identity: function(force) {
				console.log("identity; user:", Session.user);
				var deferred = $q.defer();

				if (Session.userSet() && !force) {
					deferred.resolve(Session.user);
				} else {
					Auth.ping().then(
						function(data) { deferred.resolve(Session.user);
							console.log("identity.then; user:", Session.user);
						},
						function() { deferred.resolve(Session.user); });
				}

				return deferred.promise;
			},
			authorize: function(toState, toStateParams) {
				console.log("authorize");
				return Auth.identity()
					.then(function() {
						if (toState && toState.data &&
							!Auth.isAuthorized(toState.data.access)) {
							if (Auth.isAuthenticated()) {
								console.log("authorize -> 403")
								$state.go('403'); // user is signed in but not authorized for desired state
							} else {
								// user is not authenticated. stow the state they wanted before you
								// send them to the signin state, so you can return them when you're done
								$rootScope.returnToState = toState;
								$rootScope.returnToStateParams = toStateParams;

								// now, send them to the signin state so they can log in
								console.log("authorize -> login")
								$state.go('login');
							}
						}
					});
			},

			isInitialized: function() { return Session.userSet(); },
			isAuthenticated: function() {
				return Session.userSet() && Session.user.id > 0;
			},

			isAuthorized: function(authLevel) {
	//			console.log("authLevel: ", authLevel)
				if (!Session.userSet()) { return false; }
				if (authLevel === null || authLevel === undefined) {
					return true;
				} else if (authLevel == AuthLevels.public) {
					return true;
				} else if (authLevel == AuthLevels.anon) {
					return (Session.user.id == 0);
				} else if (authLevel == AuthLevels.user) {
					return (Session.user.id > 0);
				} else if (authLevel == AuthLevels.admin) {
					return (Session.user.id > 0 && Session.user.admin);
				} else {
					console.log("Unknown authLevel", authLevel);
					return false;
				}
			},
			user: Session.user,
		};
		return Auth;
	})
	.controller('ApplicationController', function($scope, $http, AuthLevels, Auth) {
		console.log("ApplicationController enter: ", arguments);
		$scope.currentUser = Auth.user;
		$scope.authLevels = AuthLevels;
		$scope.isAuthorized = Auth.isAuthorized;
		$scope.logout = Auth.logout;
	})
	// We don't need to hook into stateChangeStart because it's all done by the resolve below!
	// .run(function($rootScope, Auth) {
	// 	$rootScope.$on('$stateChangeStart', function(event, toState, toStateParams) {
	// 		console.log("$stateChangeStart", toState.name, arguments);
	// 		console.log("$stateChangeStart Auth.user: ", Auth.user);
	// 		if (Auth.isInitialized())
	// 			Auth.authorize(toState, toStateParams);
	// 		console.log("$stateChangeStart exit");
	// 	});
	// 	$rootScope.$on('$stateChangeError', function(event, toState, toParams, fromState, fromParams, error){
	// 		console.log("$stateChangeError: ", arguments);
	// 	});
	// })
	.config(function($stateProvider) {
		// Need access to both state representations. Decorate any attribute to access private state object.
		$stateProvider.decorator('path', function(state, parentFn) {
			// Add a default empty resolve
			if (state.self.resolve === undefined) {
				state.self.resolve = {};
				state.resolve = state.self.resolve;
			}
			//Add an auth resolve
			state.resolve.authorize = function(Auth) {
				console.log("resolve enter state", state.name)
				return Auth.authorize(state, {})
			}
			return parentFn(state);
		});
	})
	.config(function($httpProvider) {
		// intercept failing http requests and go to login
		$httpProvider.interceptors.push(function($q, $location, Session) {
			return {
				'responseError': function(response) {
					if (response.status === 401 || response.status === 419) {
						// probably timed out
						Session.clear();
					}
					if (response.status === 401 || response.status === 403) {
						$location.path('/login');
					}
					return $q.reject(response);
				}
			};
		});
	})
	.directive('access', function(ngIfDirective, Auth) {
		var ngIf = ngIfDirective[0];
		return {
			transclude: ngIf.transclude,
			priority: ngIf.priority,
			terminal: ngIf.terminal,
			restrict: ngIf.restrict,
			link: function($scope, $element, $attr) {
				$attr.ngIf = function() {
					return Auth.isAuthorized($attr['access']);
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