#!/usr/bin/env node

var Client = require('ssh2').Client,
    prompt = require('syncprompt'),
    trimNewlines = require('trim-newlines'),
    pj = require('prettyjson'),
    async = require('async'),
    c = require('chalk'),
    algorithm = 'aes-256-ctr',
    Cryptr = require('cryptr'),
    algorithms = {
        kex: ['diffie-hellman-group1-sha1'],
        cipher: ['aes128-cbc']
    },
    config = require('../config'),
    validateip = require('validate-ip');

config.secret = process.env['PASS_SECRET'];

if (!config.secret || config.secret.length < 1) {
    config.secret = prompt("Secret: ", {
        secure: true
    });
	console.log(c.green('Run this command and rerun the getRoute command...'));
	console.log('export PASS_SECRET="'+config.secret+'"');
	process.exit();
    process.env['PASS_SECRET'] = config.secret;
}
cryptr = new Cryptr(config.secret);

var ip = process.argv[2];
if (!ip || !validateip(ip)) {
    console.log(c.red('First argumennt needs to be an IP address'));
    process.exit(-1);
}

var rcmd = 'sh ip route ' + ip;
var getOutput = function(host, cmd, _cb) {
    var dat = '';
    var conn = new Client();
    conn.on('ready', function() {
        conn.shell(function(err, stream) {
            if (err) throw err;
            stream.on('close', function() {
                setTimeout(function() {
                    conn.end();
                    _cb(err, dat);
                }, 10);
            }).on('data', function(data) {
                dat += data.toString();
            }).stderr.on('data', function(data) {}).on('error', function(error) {});
            setTimeout(function() {
                stream.write(cmd + '\n');
                setTimeout(function() {
                    stream.end('exit\n');
                }, 10);
            }, 10);
        });
    }).connect({
        host: host,
        port: 22,
        username: config.user,
        password: cryptr.decrypt(config.es),
        algorithms: algorithms,
    });
};
async.map(config.routers, function(router, __cb) {
    getOutput(router, rcmd, function(err, output) {
        if (err) throw err;
        __cb(err, {
            router: router,
            output: trimNewlines(output).split('\n').filter(function(o) {
                return o.split('#exit').length == 1;
            }),
        });
    });
}, function(errs, results) {
    if (errs) throw errs;
    console.log(pj.render(results));
});
