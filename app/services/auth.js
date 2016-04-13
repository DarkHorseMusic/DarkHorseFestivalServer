var jwt         = require('jwt-simple');
var User        = require('../models/user'); // Gets the mongoose model for a user.
var config      = require('../../config/database'); // Gets the db config file.

var checkAuthenticated = function(headers, adminOnly) {
    return new Promise(function(resolve, reject) {
        var token = getToken(headers);
        if (token) {
            var decoded = jwt.decode(token, config.secret);
            User.findOne({
                email: decoded.email
            }, function(err, user) {
                if (err) {
                    throw err;
                }
                
                if ((!user) || (adminOnly && (!user.isAdmin))) {
                    reject(403, 'Failed attempt to access restricted area.');
                } else {
                    resolve(user);
                }
            });
        } else {
            reject(403, 'Failed attempt to access restricted area.');
        }
    });
};

var getToken = function(headers) {
    if (headers && headers.authorization) {
        var parted = headers.authorization.split(' ');
        if (parted.length === 2) {
            return parted[1];
        } else {
            return null;
        }
    } else {
        return null;
    }
};

module.exports = { checkAuthenticated: checkAuthenticated };