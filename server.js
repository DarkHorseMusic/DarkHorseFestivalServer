var express     = require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var passport	= require('passport');
var config      = require('./config/database'); // get db config file
var User        = require('./app/models/user'); // get the mongoose model
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
console.log('For the mind, body, soul, eardrums and taste buds: http://localhost:' + port);
