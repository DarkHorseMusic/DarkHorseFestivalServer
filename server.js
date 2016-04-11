var express     = require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var passport	= require('passport');
var config      = require('./config/database'); // Gets the db config file.
var User        = require('./app/models/user'); // Gets the mongoose model for a user.
var Location    = require('./app/models/location'); // Gets the mongoose model for a location.
var port        = process.env.PORT || 5000;
var jwt         = require('jwt-simple');
 
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

// Defines default route (GET http://localhost:5000).
app.get('/', function(req, res) {
    res.send('Hello! The API is available at http://localhost:' + port + '/api');
});

// Connects to the database.
mongoose.connect(config.database);
var dbConnection = mongoose.connection;
dbConnection.on('error', console.error.bind(console, 'Connection error: '));

// Passes the passport for configuration.
require('./config/passport')(passport);

// Bundles our routes.
var apiRoutes = express.Router();

// Defines the route that allows for the creation of a new user.
apiRoutes.post('/signup', function(req, res) {
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
            
            res.json({ success: true, msg: 'The new user has been successfully created.' });
        });
    }
});

// Defines the route that allows existing users to authenticate themselves.
apiRoutes.post('/authenticate', function(req, res) {
    User.findOne({
        email: req.body.email
    }, function(err, user) {
        if (err) {
            throw err;
        }
         
        if (!user) {
            // No user with the given name found.
            res.send({success: false, msg: 'Authentication failed. E-mail address or password incorrect.'});
        } else {
            // User was found, now checks if password matches.
            user.comparePassword(req.body.password, function (err, isMatch) {
                if (isMatch && !err) {
                    // Passwords match, creates a token.
                    var token = jwt.encode(user, config.secret);
                    // Returns the information including the token as JSON.
                    res.json({ success: true, token: 'JWT ' + token });
                } else {
                    // Passwords did not match.
                    res.send({ success: false, msg: 'Authentication failed. E-mail address or password incorrect.' });
                }
            });
        }
    });
});

// Defines the route that allows authenticated users to get their user information.
apiRoutes.get('/userinfo', passport.authenticate('jwt', { session: false }), function(req, res) {
    var token = getToken(req.headers);
    if (token) {
        var decoded = jwt.decode(token, config.secret);
        User.findOne({
            email: decoded.email
        }, function(err, user) {
            if (err) {
                throw err;
            }
            
            if (!user) {
                return res.status(403).send({ success: false, msg: 'Failed attempt to access restricted area.' });
            } else {
                res.json({ success: true, fullName: user.fullName });
            }
        });
    } else {
        return res.status(403).send({ success: false, msg: 'Failed attempt to access restricted area.' });
    }
});

apiRoutes.post('/location', passport.authenticate('jwt', { session: false }), function(req, res) {
    var token = getToken(req.headers);
    if (token) {
        var decoded = jwt.decode(token, config.secret);
        User.findOne({
            email: decoded.email
        }, function(err, user) {
            if (err) {
                throw err;
            }
            
            if (!user) {
                return res.status(403).send({ success: false, msg: 'Failed attempt to access restricted area.' });
            } else {
                if (!req.body.name || !req.body.paths) {
                    res.json({ success: false, msg: 'Please provide a location name and the coordinates that form its paths.' });
                } else {
                    if (req.body.location_id) {
                        Location.findOne({ _id: req.body.location_id }, function(err, location) {
                            if (err) {
                                throw err;
                            }
                            
                            if (!location) {
                                return res.json({ success: false, msg: 'There was a problem saving the given location, the given id does not exist.' });
                            } else {
                                console.log(location);
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
            }
        });
    } else {
        return res.status(403).send({ success: false, msg: 'Failed attempt to access restricted area.' });
    }
});

apiRoutes.get('/locations', function(req, res) {
    Location.find({}, function(err, locations) {
        if (err) {
            throw err;
        }
        
        if (!locations) {
            return res.status(404).send({ success: false, msg: 'Failed to retrieve locations with an unknown error.' });
        } else {
            res.json({ success: true, locations: locations });
        }
    });
});
 
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

var getToken = function (headers) {
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

app.use('/api', apiRoutes);
 
// Start the server
app.listen(port);
console.log('For the mind, body, soul, and eardrums: http://localhost:' + port);