/*
*
*
*       FILL IN EACH FUNCTIONAL TEST BELOW COMPLETELY
*       -----[Keep the tests in the same order!]-----
*       (if additional are added, keep them at the very end!)
*/

var chaiHttp = require('chai-http');
var chai = require('chai');
var assert = chai.assert;
var server = require('../server');
var Browser = require('zombie');

var browser = new Browser();

chai.use(chaiHttp);

suite('Functional Tests', function () {
  this.timeout(5000);

  suite('API ROUTING FOR /api/threads/:board', function () {

    test('GET', function (done) {
      chai.request(server)
        .get('/api/threads/testaroo')
        .end(function (err, res) {
          assert.equal(res.status, 200);
          assert.isArray(res.body, 'Received data should be an array of threads.');
          assert.isAtMost(res.body.length, 10, 'Received data array should not have more than 10 items.')
          assert.isObject(res.body[0], 'Received array should have objects');
          assert.isArray(res.body[0].replies, 'Thread object should have an array of replies');
          assert.isAtMost(res.body[0].replies.length, 3, 'Thread should only show a max of 3 replies');
          assert.doesNotHaveAnyKeys(res.body[0], ["delete_password", "reported"], 'Thread object should not have delete_password or reported');
          assert.hasAnyKeys(res.body[0], ["replycount"], 'Thread object should have a reply count.')
          done();
        });
    });

    test('POST', function (done) {
      chai.request(server)
        .post('/api/threads/testaroo')
        .type('form')
        .send({
          "text": 'This is a post made during the chai testing process!',
          "delete_password": 'some-pass'
        })
        .end(function (err, res) {
          assert.equal(res.status, 200, 'Request should be successful.');
          //use zombie to make sure latest post is the one we just made
          browser.visit('https://fcc-is-msg.kpworthi.repl.co/b/testaroo', function () {
            let firstThread = browser.querySelector('.thread');
            browser.assert.text(firstThread.querySelector('h3'), 'This is a post made during the chai testing process!');
            done();
          });

        });
    });

    test('PUT', function (done) {
      //use zombie to grab the latest thread's id
      browser.visit('https://fcc-is-msg.kpworthi.repl.co/b/testaroo', function () {
        let threadId = browser.document.querySelector(".id").textContent.split(' ')[1];

        chai.request(server)
          .put('/api/threads/testaroo')
          .type('form')
          .send({
            "report_id": threadId
          })
          .end(function (err, res) {
            assert.equal(res.status, 200, 'Request should be successful.');
            assert.equal(res.text, 'Thread has been reported.', 'Response should note "Thread has been reported."');
            done();
          });
      });
    });

    test('DELETE', function (done) {
      //use zombie to grab the latest thread's id
      browser.visit('https://fcc-is-msg.kpworthi.repl.co/b/testaroo', function () {
        let threadId = browser.document.querySelector(".id")
          .textContent.split(' ')[1];

        chai.request(server)
          .delete('/api/threads/testaroo')
          .send({
            "thread_id"      : threadId,
            "delete_password": 'some-pass'
          })
          .end(function (err, res) {
            assert.equal(res.status, 200, 'Request should be successful.');
            assert.equal(res.text, 'Delete successful.', 'Server should send the message "Delete successful." when delete is performed.');
            done();
          })
      });
    });

  });

  suite('API ROUTING FOR /api/replies/:board', function () {

    test('GET', function (done) {
      
      //use GET request to get list of threads to select an ID
      chai.request(server)
        .get('/api/threads/testaroo')
        .end(function (err, res) {
          let threadId = res.body[0]._id;

          chai.request(server)
            .get(`/api/replies/testaroo?thread_id=${threadId}`)
            .end(function (err, res) {
              let response = res.body;

              assert.equal(res.status, 200, 'Request should be successful.');
              assert.isObject(response, 'Response data should be an object (the thread.)');
              assert.isArray(response.replies, 'Response should have an array of replies.');
              assert.hasAllKeys(response.replies[0], ["_id", "text", "created_on"], 'A reply should include _id, text, created.');
              assert.doesNotHaveAnyKeys(response.replies[0], ["reported", "delete_password"], 'A reply should not include reported status or the delete hash.');
              done();
            });
        });
    });

    test('POST', function (done) {
      
      //use GET request to get list of threads to select an ID
      chai.request(server)
        .get('/api/threads/testaroo')
        .end(function (err, res) {
          let threadId = res.body[0]._id;
          let replyNum = res.body[0].replycount;

          chai.request(server)
            .post(`/api/replies/testaroo`)
            .type('form')
            .send({
              "thread_id"      : threadId,
              "text"           : 'This is a reply made during the chai testing process!',
              "delete_password": 'some-pass'
            })
            .end(function (err, res) {
              assert.equal(res.status, 200, 'Request should be successful.')
              chai.request(server)
                .get(`/api/replies/testaroo?thread_id=${threadId}`)
                .end(function (err, res) {
                  let response = res.body;

                  assert.equal(response.replies[response.replies.length-1].text, 'This is a reply made during the chai testing process!', 'Last reply should be the one we just made')
                  assert.equal(response.replies.length, replyNum+1, 'Reply total should be one more than it used to be.')

                  done();
                });
            });
        });
    });

    test('PUT', function (done) {
      
      //use GET request to get list of threads to select an ID
      chai.request(server)
        .get('/api/threads/testaroo')
        .end(function (err, res) {
          let threadId = res.body[0]._id;
          let replyId  = res.body[0].replies[res.body[0].replies.length-1]._id;

          chai.request(server)
            .put('/api/replies/testaroo')
            .type('form')
            .send({
              "thread_id": threadId,
              "reply_id" : replyId
            })
            .end(function (err, res){
              assert.equal(res.status, 200, 'Request should be successful.');
              assert.equal(res.text, 'Reply has been reported.', 'Response should note "Reply has been reported."');
              done();
            });
          });
    });

    test('DELETE', function (done) {
      
      //use GET request to get list of threads to select an ID
      chai.request(server)
        .get('/api/threads/testaroo')
        .end(function (err, res) {
          let threadId = res.body[0]._id;
          let replyId  = res.body[0].replies[res.body[0].replies.length-1]._id;

          chai.request(server)
            .delete('/api/replies/testaroo')
            .type('form')
            .send({
              "thread_id"      : threadId,
              "reply_id"       : replyId,
              "delete_password": 'some-pass'
            })
            .end(function (err, res) {
              assert.equal(res.status, 200, 'Request should be successful.')
              chai.request(server)
                .get(`/api/replies/testaroo?thread_id=${threadId}`)
                .end(function (err, res) {
                  let response = res.body;

                  assert.equal(response.replies[response.replies.length-1].text, '[deleted]', 'Last reply should now read "[deleted]"')
                  done();
            });
          });
        });
    });

  });
})


//learning more about zombie testing
/*
  describe('Zombie goes to page', function() {
    this.timeout(5000);

    before(function (done) {
      browser.visit('https://fcc-is-msg.kpworthi.repl.co/b/testaroo/', done)
    });

    it('should display with correct title and thread limit', function() {
      browser.assert.success();
      browser.assert.elements('.thread', {atMost: 10});
      browser.assert.text('title', 'Anony-board testaroo!');
    });

    describe('and posts a new thread', function () {

      before(function (done) {
        browser.fill('#newThread > textarea', `Zombie has are created an text fill-in!`)
               .fill('#newThread > input', 'some-pass')
               .pressButton(browser.querySelector('#thread-submit'), done);
      });

      it('should have max 10 threads and new thread should be at the top', function(){
        browser.assert.success();
        browser.assert.elements('.thread', { atMost: 10 });
        browser.assert.text(browser.querySelector('.thread').querySelector('h3'), `Zombie has are created an text fill-in!`);
      });

    });
/*
    describe('and posts a reply to his thread', function(){

      before(function (done) {
        browser.fill('')
      });
    });

    describe('and deletes his reply', function(){

        before(function (done) {
          browser.fill('select > password-area', 'some-pass')
                 .pressButton('the delete button', done);
        });
    });

  });

//});

*/
