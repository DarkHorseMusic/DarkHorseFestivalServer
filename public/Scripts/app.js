angular.module('darkHorseFestival', [])
.config(['$httpProvider', function($httpProvider) {
    $httpProvider.defaults.headers.post['X-Requested-With'] = "XMLHttpRequest";
}]);