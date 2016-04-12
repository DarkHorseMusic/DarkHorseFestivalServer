var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var crypto = require('crypto');

// Stores configuration that relates to how passwords are encrypted.
var config = {
    iterations: Number(process.env.ITERATIONS),
    keySize: 512,
    digest: 'sha512'
};

// Sets up the mongoose model for a user.
var UserSchema = new Schema({
    email: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    isAdmin: {
        type: Boolean,
        required: true,
        default: false
    },
    isEmailConfirmed: {
        type: Boolean,
        required: true,
        default: false
    },
    emailConfirmationToken: {
        type: String,
        required: false
    }
});

// Encrypts the password before it gets saved to the database.
UserSchema.pre('save', function (next) {
    var user = this;
    if (this.isModified('password') || this.isNew) {
        crypto.randomBytes(128, function(err, salt) {
            if (err) {
                return next(err);
            }

            crypto.pbkdf2(user.password, salt, config.iterations, config.keySize, config.digest, function(err, hash) {
                if (err) {
                    return next(err);
                }

                var combined = new Buffer(hash.length + salt.length + 8);
                combined.writeUInt32BE(salt.length, 0, true);
                combined.writeUInt32BE(config.iterations, 4, true);
                salt.copy(combined, 8);
                hash.copy(combined, salt.length + 8);
                user.password = combined.toString('base64');
                next();
            });
        });
    } else {
        return next();
    }
});

// Creates an email confirmation token before saving a new user to the database.
UserSchema.pre('save', function(next) {
    var user = this;
    if (!this.isNew) {
        return next();
    }

    crypto.randomBytes(32, function(err, salt) {
        if (err) {
            return next(err);
        }

        user.emailConfirmationToken = salt.toString('hex');
        next();
    });
});

// Defines a method that allows a plaintext password to be compared to the user's encrypted password for verification.
UserSchema.methods.comparePassword = function (passw, callback) {
    var combined = new Buffer(this.password, 'base64');
    var saltBytes = combined.readUInt32BE(0);
    var hashBytes = combined.length - saltBytes - 8;
    var iterations = combined.readUInt32BE(4);
    var salt = combined.slice(8, saltBytes + 8);
    var hash = combined.toString('base64', saltBytes + 8);

    crypto.pbkdf2(passw, salt, iterations, hashBytes, config.digest, function(err, verify) {
        if (err) {
            return callback(err, false);
        }

        callback(null, verify.toString('base64') === hash);
    });
};

module.exports = mongoose.model('User', UserSchema);