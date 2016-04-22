var express     = require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var passport	= require('passport');
var User        = require('./app/models/user'); // Gets the mongoose model for a user.
var Location    = require('./app/models/location'); // Gets the mongoose model for a location.
var port        = process.env.PORT || 5000;
var jwt         = require('jwt-simple');
var emailing    = require('./app/services/emailing.js');
var auth        = require('./app/services/auth.js');

// Gets our request parameters.
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Sets log to console.
app.use(morgan('dev'));

// Sets the app to initialise and use the passport package.
app.use(passport.initialize());

// Sets up CORS.
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
});

// Connects to the database.
mongoose.connect(process.env.MONGOLAB_URI);
var dbConnection = mongoose.connection;
dbConnection.on('error', console.error.bind(console, 'Connection error: '));

// Passes the passport for configuration.
require('./config/passport')(passport);

var signUpRoute = function(req, res) {
    if (!req.body.email || !req.body.password || !req.body.fullName) {
        res.json({ success: false, msg: 'Please provide e-mail, password and full name.' });
    } else {
        var newUser = new User({
            email: req.body.email,
            password: req.body.password,
            fullName: req.body.fullName
        });

        newUser.save(function(err) {
            if (err) {
                return res.json({ success: false, msg: 'A user with the given e-mail address already exists.' });
            }
            
            try {
                if (newUser.emailConfirmationToken) {
                    var emailToken = new Buffer(newUser.email, 'utf8').toString('hex');
                    emailing.sendEmailConfirmationMessage(newUser.email, newUser.emailConfirmationToken, emailToken, newUser.fullName);
                }
            } catch(err) {
                console.log(err);
            }
            
            return res.json({ success: true, msg: 'Your new user has been successfully created, please check your e-mail to verify your address before logging in.' });
        });
    }
};

var sendVerificationEmailRoute = function(req, res) {
    if (!req.body.email) {
        res.json({ success: false, msg: 'Please provide the e-mail address to be verified.' });
    } else {
        User.findOne({ email: req.body.email, isEmailConfirmed: false }, function(err, user) {
            if (err) {
                throw err;
            }

            if (!user) {
                return res.json({ success: false, msg: 'Invalid request.' });
            }

            if (!user.emailConfirmationToken) {
                return res.json({ success: false, msg: 'There is a problem with this user, please contact our support.' });
            }

            try {
                var emailToken = new Buffer(user.email, 'utf8').toString('hex');
                emailing.sendEmailConfirmationMessage(user.email, user.emailConfirmationToken, emailToken, user.fullName);
            } catch(err) {
                console.log(err);
                return res.json({ success: false, msg: 'There was a problem sending the e-mail, please try again or contact our support.'});
            }

            return res.json({ success: true, msg: 'The verification e-mail has been sent, please check your e-mail to verify it.' });
        });
    }
};

var verifyRoute = function(req, res) {
    var emailConfirmationToken = req.params[0];
    var emailToken = req.params[1];
    var email = new Buffer(emailToken, 'hex').toString('utf8');

    User.findOne({ email: email, isEmailConfirmed: false }, function(err, user) {
        if (err) {
            throw err;
        }

        if (!user) {
            return res.json({ success: false, msg: 'The URL provided is invalid.' });
        }

        if (user.emailConfirmationToken != emailConfirmationToken) {
            return res.json({ success: false, msg: 'The URL provided is invalid.' });
        }

        user.isEmailConfirmed = true;
        user.save();

        return res.json({ success: true });
    });
};

var authenticateRoute = function(req, res) {
    User.findOne({
        email: req.body.email
    }, function(err, user) {
        if (err) {
            throw err;
        }

        if (!user) {
            // No user with the given name found.
            res.json({success: false, msg: 'Authentication failed. E-mail address or password incorrect.'});
        } else {
            // User was found, now checks if password matches.
            user.comparePassword(req.body.password, function (err, isMatch) {
                if (isMatch && !err) {
                    if (user.isEmailConfirmed) {
                        // Passwords match, e-mail is confirmed, creates a token.
                        var token = jwt.encode(user, process.env.JWT_SECRET);
                        // Returns the information including the token as JSON.
                        res.json({ success: true, token: 'JWT ' + token });
                    } else {
                        // Passwords match but e-mail isn't confirmed, fails authentication.
                        res.json({ success: false, msg: 'Your e-mail address has not been verified yet, please verify it.', emailNotVerified: true });
                    }
                } else {
                    // Passwords did not match.
                    res.json({ success: false, msg: 'Authentication failed. E-mail address or password incorrect.' });
                }
            });
        }
    });
};

var userInfoRoute = function(req, res) {
    auth.checkAuthenticated(req.headers).then(function(user) {
        return res.json({ success: true, fullName: user.fullName });
    }, function(httpStatus, msg) {
        return res.status(httpStatus).json({ success: false, msg: msg });
    });
};

var locationPostRoute = function(req, res) {
    auth.checkAuthenticated(req.headers, true).then(function(user) {
        if (!req.body.name || !req.body.paths) {
            return res.json({ success: false, msg: 'Please provide a location name and the coordinates that form its paths.' });
        } else {
            if (req.body.location_id) {
                Location.findOne({ _id: req.body.location_id }, function(err, location) {
                    if (err) {
                        throw err;
                    }

                    if (!location) {
                        return res.json({ success: false, msg: 'There was a problem saving the given location, the given id does not exist.' });
                    } else {
                        location.name = req.body.name;
                        location.paths = req.body.paths;
                        setLocationData(location, req.body);
                        location.save(function(err) {
                            if (err) {
                                return res.json({ success: false, msg: 'There was a problem saving the given location, probably a malformed request.' });
                            }
                            
                            return res.json({ success: true, msg: 'The existing location has been successfully saved.', location_id: location._id });
                        });
                    }
                });
            } else {
                var newLocation = new Location({
                    name: req.body.name,
                    paths: req.body.paths
                });

                setLocationData(newLocation, req.body);
                newLocation.save(function(err) {
                    if (err) {
                        return res.json({ success: false, msg: 'There was a problem saving the given location, probably a malformed request.' });
                    }

                    return res.json({ success: true, msg: 'The new location has been successfully saved.', location_id: newLocation._id });
                });
            }
        }
    }, function(httpStatus, msg) {
        return res.status(httpStatus).json({ success: false, msg: msg });        
    });
};

var locationGetRoute = function(req, res) {
    if ((!req.query.location_id) && (!req.query.name)) {
        return res.json({ success: false, msg: 'Please provide a location id or a location name.' });
    }

    if (req.query.location_id) {
        Location.findOne({ _id: req.query.location_id }, function(err, location) {
            if (err) {
                throw err;
            }

            if (!location) {
                return res.json({ success: false, msg: 'There was a problem retrieving the location.' });
            }

            return res.json({ success: true, location: location });
        });
    }

    if (req.query.name) {
        Location.findOne({ name: { '$regex': req.query.name } }, function(err, location) {
            if (err) {
                throw err;
            }

            if (!location) {
                return res.json({ success: false, msg: 'There was a problem retrieving the location.' });
            }

            return res.json({ success: true, location: location });
        });
    }
};

var locationDeleteRoute = function(req, res) {
    auth.checkAuthenticated(req.headers, true).then(function(user) {
        if (!req.body.location_id) {
            return res.json({ success: false, msg: 'Please provide a location id.' });
        }

        Location.findOne({ _id: req.body.location_id }, function(err, location) {
            if (err) {
                throw err;
            }

            if (!location) {
                return res.json({ success: false, msg: 'There was a problem removing the location, the given id does not exist.' });
            }

            location.remove(function (err, location) {
                if (err) {
                    return res.json({ success: false, msg: 'There was a problem removing the given location.' });
                }

                return res.json({ success: true, msg: 'The existing location has been successfully removed.', location_id: location._id });
            });
        });
    }, function(httpStatus, msg) {
        return res.status(httpStatus).json({ success: false, msg: msg });
    });
};

var locationsRoute = function(req, res) {
    Location.find({}, function(err, locations) {
        if (err) {
            throw err;
        }

        if (!locations) {
            return res.status(404).json({ success: false, msg: 'Failed to retrieve locations with an unknown error.' });
        } else {
            res.json({ success: true, locations: locations });
        }
    });
};

var setLocationData = function(location, reqBody) {
    if (reqBody.strokeColor) {
        location.strokeColor = reqBody.strokeColor;
    }

    if (reqBody.strokeOpacity) {
        location.strokeOpacity = Number(reqBody.strokeOpacity);
    }

    if (reqBody.strokeWeight) {
        location.strokeWeight = Number(reqBody.strokeWeight);
    }

    if (reqBody.fillColor) {
        location.fillColor = reqBody.fillColor;
    }

    if (reqBody.fillOpacity) {
        location.fillOpacity = Number(reqBody.fillOpacity);
    }
};

// Bundles our API routes.
var apiRoutes = express.Router();

// Defines the route that allows for the creation of a new user.
apiRoutes.post('/signup', signUpRoute);

// Defines the route that allows existing users to request the verification e-mail again.
apiRoutes.post('/send-verify-email', sendVerificationEmailRoute);

// Defines the route that allows existing users to verify their e-mail address. 
apiRoutes.get(/^\/verify\/(\w+)(?:\/)(\w+)(?:\/?)$/, verifyRoute);

// Defines the route that allows existing users to authenticate themselves.
apiRoutes.post('/authenticate', authenticateRoute);

// Defines the route that allows authenticated users to get their user information.
apiRoutes.get('/userinfo', passport.authenticate('jwt', { session: false }), userInfoRoute);

// Defines the route that allows authenticated admin users to create a new location or modify an existing one.
apiRoutes.post('/location', passport.authenticate('jwt', { session: false }), locationPostRoute);

// Defines the route that allows users to fetch a location from its id or name.
apiRoutes.get('/location', locationGetRoute);

// Defines the route that allows authenticated admin users to delete an existing location.
apiRoutes.delete('/location', passport.authenticate('jwt', { session: false }), locationDeleteRoute);

// Defines the route that allows users to fetch all existing locations.
apiRoutes.get('/locations', locationsRoute);

// Defines the API routes.
app.use('/api', apiRoutes);

// Defines static pages to be used when not calling the API.
app.use(express.static(__dirname + '/public'));

// Starts the server.
app.listen(port, function() {
    console.log('For the mind, body, soul, and eardrums: ' + process.env.API_HOST + ':' + port);
});