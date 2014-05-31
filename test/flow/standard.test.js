'use strict';

var expect = require('chai').expect;
var express = require('express');
var request = require('supertest');
var bodyParser = require('body-parser')
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var Passwordless = require('../../lib');
var TokenStoreMock = require('../mock/tokenstore');

describe('passwordless', function() {
	describe('flow', function() {

		var delivered = [];
		var deliveryMockVerify = function(contactToVerify, done) {
				setTimeout(function() {
					if(contactToVerify === 'error') {
						done('error', null);
					} else if (contactToVerify === 'unknown') {
						done(null, null);
					} else {
						done(null, 'UID/' + contactToVerify);
					}
				}, 0);
			};

		var deliveryMockSend = function(name) {
			return function(tokenToSend, user, done) {
					setTimeout(function() {
						if(user === 'UID/deliveryError') {
							return done('error');
						}

						delivered.push([tokenToSend, user, name]);
						done();
					}, 0);
				}
			}

		describe('standard', function() {

			var app = express();
			var passwordless = new Passwordless(new TokenStoreMock());
			passwordless.add(deliveryMockVerify, deliveryMockSend());

			app.use(bodyParser());
			app.use(cookieParser());
			app.use(expressSession({ secret: '42' }));

			app.use(passwordless.sessionSupport());
			app.use(passwordless.acceptToken());

			app.get('/unrestricted',
				function(req, res){
					res.send(200);
			});

			app.get('/restricted', passwordless.restricted(),
				function(req, res){
					res.send(200, 'authenticated');
			});

			app.post('/login', passwordless.requestToken(),
				function(req, res){
					res.send(200);
			});

			app.get('/logout', passwordless.logout(),
				function(req, res){
					res.send(200);
			});

			var agent = request.agent(app);

			it('should allow access to unrestricted resources', function (done) {
				agent
					.get('/unrestricted')
					.expect(200, done);
			})

			it('should not allow access to restricted resources', function (done) {
				agent
					.get('/restricted')
					.expect(401, done);
			})

			it('should verify a proper user', function (done) {
				agent
					.post('/login')
					.send( { email: 'alice' } )
					.expect(200, done);
			})

			it('should have sent a token', function () {
				expect(delivered.length).to.equal(1);
				expect(delivered[0][0]).to.have.length.above(0);
				expect(delivered[0][1]).to.equal('UID/alice');
			})

			it('should still not allow access to restricted resources', function (done) {
				agent
					.get('/restricted')
					.expect(401, done);
			})

			it('should allow access to a restricted resource with a proper token', function (done) {
				agent
					.get('/restricted?token=' + delivered[0][0])
					.expect(200, done);
			})

			it('should now allow access to a restricted resource without a token', function (done) {
				agent
					.get('/restricted?token=' + delivered[0][0])
					.expect(200, done);
			})

			it('should successfully log out', function (done) {
				agent
					.get('/logout')
					.expect(200, done);
			})

			it('should not anymore allow access to restricted resources', function (done) {
				agent
					.get('/restricted')
					.expect(401, done);
			})
		})
	})
})