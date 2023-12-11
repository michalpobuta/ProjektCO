const expect = require('chai').expect;
const request = require('supertest');
const app = require('../app'); // Zaimportuj swój serwer Node.js

describe('API endpoints', () => {
  it('GET /getAllFilms', (done) => {
    request(app)
      .get('/getAllFilms')
      .end((err, res) => {
        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.an('array');
        done();
      });
  });

  it('GET /getAllUsers', (done) => {
    request(app)
      .get('/getAllUsers')
      .end((err, res) => {
        expect(res.statusCode).to.equal(200);
        expect(res.body).to.be.an('array');
        done();
      });
  });

  // Dodaj więcej testów zgodnie z potrzebami
});

