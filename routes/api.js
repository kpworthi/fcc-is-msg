/*
*       Complete the API routing below
*/

'use strict';

var   expect        = require('chai').expect;
const bcrypt        = require('bcrypt'),
      saltRounds    = 12;
var { MongoClient } = require('mongodb'),
      ObjectId      = require('mongodb').ObjectID;
const BOARD_LIST    = ['general', 'movies', 'tech', 'games', 'testaroo']

async function connection (callback) {
  const CONN_STRING = process.env.DB;
  const client = new MongoClient(CONN_STRING, { useNewUrlParser: true, useUnifiedTopology: true});

  try{
    await client.connect();
    await callback(client);
  }
  catch (err) {
    console.error(err);
  }
  finally{
    await client.close();
  }
}

/* DB STRUCTURE
==================
Database: msg-board
Collections: the individual boards
Documents: each thread

Valid boards: general, movies, tech, games, testaroo
===================
*/

/*
  thread object
    _id: 12345
    text: 'post text'
    created_on: somedateobject
    bumped_on: somedateobject (init to created_on)
    reported: 'false'
    delete_password: hashedpw
    replies: [replyObj, replyObj, replyObj]
*/

class Thread {
  constructor(text, delPw){
    this.text = text;
    this.created_on = new Date();
    this.bumped_on = new Date();
    this.reported = false;
    this.delete_password = delPw;
    this.replies = [];
  }
}

/*
  reply object
    _id: 12345
    text: 'post text'
    created_on: somedateobject
    delete_password: hashedpw
    reported: 'false'
*/

class Reply {
  constructor(text, delPw){
    this._id = ObjectId();
    this.text = text;
    this.created_on = new Date();
    this.delete_password = delPw;
    this.reported = false;
  }
}

module.exports = function (app) {
  
  // Threads ============================= 
  app.route('/api/threads/:board')
    .get(function(req, res){
      let theBoard = req.params.board;
      if (!BOARD_LIST.includes(theBoard)){
        console.log('A GET request specified an invalid board: ' + theBoard);
        res.send('Board requested is invalid.')
      }
      else{
        connection(async function(client){
          let cursor = await client.db('msg-board').collection(theBoard).find({}, {projection: {"delete_password": 0, "reported": 0}})
            .sort({bumped_on: -1})
            .limit(10);
          let cursorArr = await cursor.toArray();
          
          //add a reply count before sending back to client
          //also only show most the three most recently added replies
          cursorArr.map( value => {
            value.replycount = value.replies.length;
            value.replies = value.replies.slice(-3);
            return value;
          });

          console.log('A GET request was successfully sent.')
          res.send(cursorArr);
        });
      }
    })
    .post(function(req, res){
      let formData = req.body;
      if (formData.board===undefined)
        formData.board = req.url.match(/\/(\w+)\/?$/)[1];
      if (!BOARD_LIST.includes(formData.board)){
        console.log('A thread POST request specified an invalid board: ' + formData.board);
        res.send('Board entered is invalid.')
      }
      else{
        connection(async function(client){
          let salt = bcrypt.genSaltSync(saltRounds);
          let hash = bcrypt.hashSync(formData.delete_password, salt);
          let newPost = new Thread(formData.text, hash);

          let posting = await client.db('msg-board').collection(formData.board).insertOne(newPost);
          if (posting.insertedCount !== 1){
            res.send('Sorry, an error occurred during posting. Please try again.');
            console.log('Something went wrong. A new thread was not posted after an attempt was made.' + Date().slice(0,33));
          }
          else{
            res.redirect(`/b/${formData.board}`);
            console.log('A user has successfully created a new thread on /' + formData.board + ' at ' + Date().slice(0,33));
          }
        });
      }
    })
    .put(function(req, res){
      let formData = req.body,
          threadId = formData.report_id;
      if (formData.board===undefined)
        formData.board = req.url.match(/\/(\w+)\/?$/)[1];
      connection (async function (client) {
        let thread = await client.db('msg-board').collection(formData.board).findOne({_id: new ObjectId(threadId)});
        if(thread === null){
          res.send('Invalid Thread ID, please try again.');
          console.log('A thread PUT request specified an invalid thread.' + Date().slice(0,33));
        }
        else{
          let result = await client.db('msg-board').collection(formData.board).updateOne({_id: new ObjectId(threadId)}, {$set: {"reported": true}});
          if (result.modifiedCount !== 1) {
            res.send('Sorry, an error occurred during reporting. Please try again.');
            console.log('Something went wrong. A new thread was not reported after an attempt was made.' + Date().slice(0,33));
          }
          else {
            res.send('Thread has been reported.');
            console.log('A user has reported a thread: ' + threadId + ' at ' + Date().slice(0,33));
          }
        }
      });
    })
    .delete(function(req, res){
      let formData       = req.body;
      if (formData.board===undefined)
        formData.board = req.url.match(/\/(\w+)\/?$/)[1];

      connection(async function(client){
        let result  = await client.db('msg-board').collection(formData.board).findOne({_id: new ObjectId(formData.thread_id)}),
            reqHash = result.delete_password

        let passCheck = bcrypt.compareSync(formData.delete_password, reqHash);

        if (passCheck){
          let result = await client.db('msg-board').collection(formData.board).deleteOne({_id: new ObjectId(formData.thread_id)});
          if (result.deletedCount === 1){
            res.send('Delete successful.');
            console.log('A user has successfully deleted a thread on /' + formData.board + ' at ' + Date().slice(0.33));
          }
          else {
            console.log('Something went wrong. A deletion was not performed after a request was made.' + Date().slice(0,33));
            res.send('Sorry, an error occurred during deletion. Please try again.');
          }
        }
        else {
          console.log('Request for delete was performed using an incorrect password at ' + Date().slice(0,33));
          res.send('Incorrect password supplied for deletion.');
        }
      });

    });


  // Replies ============================= 
  app.route('/api/replies/:board')
    .get(function(req, res){
      let theBoard  = req.params.board;
      let threadId = req.query.thread_id;

      connection(async function (client) {
        let thread = await client.db('msg-board').collection(theBoard).findOne({_id: new ObjectId(threadId)});
        thread.replies.forEach( reply => {
          delete reply.delete_password;
          delete reply.reported;
        });
        
        if(thread === null){
          console.log('An error occurred while fetching thread for thread-view. ' + Date().slice(0,33));
          res.send('Something went wrong fetching this thread. Please try again.');
        }
        else{
          console.log('Thread-view GET request successfully submitted.');
          res.send(thread);
        }


      });
    })
    .post(function(req, res){
      let formData       = req.body;
      if (formData.board===undefined)
        formData.board = req.url.match(/\/(\w+)\/?$/)[1];

      connection(async function (client) {
        let salt = bcrypt.genSaltSync(saltRounds);
        let hash = bcrypt.hashSync(formData.delete_password, salt);
        let newReply = new Reply(formData.text, hash);

        let thread = await client.db('msg-board').collection(formData.board).findOne({ _id: new ObjectId(formData.thread_id) });
        if (thread === null) {
          console.log('A user attempted to reply to an incorrect thread ID. ' + Date().slice(0, 33));
          res.send('Thread does not exist. Please check your thread ID when replying.');
          return null;
        }

        thread.replies.push(newReply);
        thread.bumped_on = new Date();
        let result = await client.db('msg-board').collection(formData.board).updateOne({ _id: new ObjectId(formData.thread_id) }, { $set: { "bumped_on": thread.bumped_on, "replies": thread.replies} })

        if (result.modifiedCount !== 1) {
          res.send('Sorry, an error occurred sending your reply. Please try again.')
          console.log('Something went wrong. A new reply was not posted after an attempt was made.' + Date().slice(0, 33));
        }
        else {
          res.redirect(`/b/${formData.board}/${formData.thread_id}`);
          console.log('A user has successfully created a new reply on /' + formData.board + ' at ' + Date().slice(0, 33));
        }
      });
    })
    .put(function(req, res){
      let formData = req.body;
      if (formData.board===undefined)
        formData.board = req.url.match(/\/(\w+)\/?$/)[1];
      connection (async function (client) {
        let thread    = await client.db('msg-board').collection(formData.board).findOne({_id: new ObjectId(formData.thread_id)}),
            replyInd  = thread.replies.findIndex( value => value._id.toString() === new ObjectId(formData.reply_id).toString());
        if(thread === null || replyInd === -1){
          res.send('Invalid Thread or Reply ID, please try again.');
          console.log('A thread PUT request specified an invalid thread or reply.' + Date().slice(0,33));
        }
        else{
          thread.replies[replyInd].reported = true;
          
          let modResult = await client.db('msg-board').collection(formData.board).updateOne({_id: new ObjectId(formData.thread_id)}, {$set: {"replies": thread.replies}});

          if (modResult.modifiedCount !== 1) {
            res.send('Sorry, an error occurred during reporting. Please try again.');
            console.log('Something went wrong. A new thread was not reported after an attempt was made.' + Date().slice(0,33));
          }
          else {
            res.send('Reply has been reported.');
            console.log('A user has reported a reply: ' + formData.reply_id + ' at ' + Date().slice(0,33));
          }
        }
      });
    })
    .delete(function(req, res){
      let formData     = req.body;
      if (formData.board===undefined)
        formData.board = req.url.match(/\/(\w+)\/?$/)[1];

      connection(async function(client){
        let thread  = await client.db('msg-board').collection(formData.board).findOne({_id: new ObjectId(formData.thread_id)}),
            replyInd    = thread.replies.findIndex( value => value._id.toString() === new ObjectId(formData.reply_id).toString());
        
            if(replyInd === -1){
              console.log('User sent reply-delete request with an invalid reply ID.');
              res.send('The thread or specific reply could not be found, please try again.');
              return null;
            }
            let reqHash = thread.replies[replyInd].delete_password;

        let passCheck = bcrypt.compareSync(formData.delete_password, reqHash);  

        if (passCheck){
          thread.replies[replyInd].text = "[deleted]";
          //below completely removes the reply, as an alternative
          //thread.replies = thread.replies.slice(0, replyInd).concat(thread.replies.slice(replyInd+1));
          let modResult = await client.db('msg-board').collection(formData.board).updateOne({_id: new ObjectId(formData.thread_id)}, {$set: {"replies": thread.replies}});
          if (modResult.modifiedCount === 1){
            res.send('Delete successful.');
            console.log('A user has successfully deleted a reply in /' + formData.board + '/' + formData.thread_id + ' at ' + Date().slice(0.33));
          }
          else {
            console.log('Something went wrong. A reply deletion was not performed after a request was made.' + Date().slice(0,33));
            res.send('Sorry, an error occurred during deletion. Please try again.');
          }
        }
        else {
          console.log('Request for reply delete was performed using an incorrect password at ' + Date().slice(0,33));
          res.send('Incorrect password supplied for deletion.');
        }
      });

    });

};
