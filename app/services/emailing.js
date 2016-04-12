var SparkPost = require('sparkpost');
var sparky = new SparkPost();

var sendEmailConfirmationMessage = function(email, confirmationToken, emailToken, fullName) {
    var verifyLink = process.env.API_HOST + ':' + process.env.PORT + '/api/verify/' + confirmationToken + '/' + emailToken;
    sparky.transmissions.send({
        transmissionBody: {
            content: {
                from: 'darkhorse@' + process.env.SPARKPOST_SANDBOX_DOMAIN,
                subject: 'Confirm your Dark Horse Music account.',
                html: '<html><body><p>Hello' + (((fullName != null) && (fullName.length > 0)) ? (', ' + fullName) : '') + '!</p><p>You have just signed up for an account with Dark Horse Music, so we need you to confirm your email address by clicking <a href="' + verifyLink + '">this link</a>.</p><p>If you have not created an account we apologise; please simply ignore this email.</p></body></html>'
            },
            recipients: [ { address: email } ]
        }
    }, function(err, res) {
        if (err) {
            console.log(err);
        }
    });
};

module.exports = {
    sendEmailConfirmationMessage: sendEmailConfirmationMessage
};