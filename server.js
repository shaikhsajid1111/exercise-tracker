const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')
const shortId = require("shortid")
const mongoose = require('mongoose')
const mongodb = require("mongodb")

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/exercise-track',{ useUnifiedTopology: true,useNewUrlParser: true })
const moment = require("moment");
app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

const Schema = mongoose.Schema;

/*models*/
const ExerciseSchema = new Schema({
    description: {
        type: String,
        required: true,
        maxlength: [25, 'Description too long, not greater than 25']
    },
    duration: {
        type: Number,
        required: true,
        min: [1, 'Duration too short, at least 1 minute']
    },
    date: {
        type: Date, 
        default: Date.now
    },
    userId: {
        type: String,
        required: true
    }
})

const UserSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: shortId.generate
    },
    username: {
        type: String,
        unique: true,
        required: true
    }
})

/*models instance*/
const User = mongoose.model('User', UserSchema);
const Exercise = mongoose.model('Exercise', ExerciseSchema);


console.log(mongoose.connection.readyState);

/*routes*/
app.post('/api/exercise/new-user', (req, res, next) => {
    const { username } = req.body;
    User.findOne({ username }).then(user => {
        if (user) throw new Error('username already taken');
        return User.create({ username })
    })
        .then(user => res.status(200).send({
            username: user.username,
            _id: user._id
        }))
        .catch(err => {
            console.log(err);
            res.status(500).send(err.message);
        })
})

app.post('/api/exercise/add', (req, res, next) => {
    let { userId, description, duration, date } = req.body;
    User.findOne({ _id: userId }).then(user => {
        if (!user) throw new Error('Unknown user with _id');
        date = req.body.date ? new Date(req.body.date) : new Date();
        return Exercise.create({
            description, duration, date, userId
        })
            .then(ex => res.status(200).send({
                username: user.username,
                description : description,
                duration: parseInt(duration),
                _id: user._id,
                date: date.toDateString()
            }))
    })
        .catch(err => {
            console.log(err);
            res.status(500).send(err.message);
        })
})

app.get('/api/exercise/log?', (req, res, next) => {
    let { userId, from, to, limit } = req.query;
    from = moment(from, 'YYYY-MM-DD').isValid() ? moment(from, 'YYYY-MM-DD') : 0;
    to = moment(to, 'YYYY-MM-DD').isValid() ? moment(to, 'YYYY-MM-DD') : moment().add(1000000000000);
    User.findById(userId).then(user => {
        if (!user) throw new Error('Unknown user with _id');
        Exercise.find({ userId })
            .where('date').gte(from).lte(to)
            .limit(+limit).exec()
            .then(log => res.status(200).send({
                _id: userId,
                username: user.username,
                count: log.length,
                log: log.map(o => ({
                    description: o.description,
                    duration: parseInt(o.duration),
                    date: o.date.toDateString()
                }))
            }))
    })
        .catch(err => {
            console.log(err);
            res.status(500).send(err.message);
        })
})


/**************/


app.get("/api/exercise/users", function(req, res) {

  User.find({}, function(err, data) {
    if (err) err;
    let obj = data.map(item => {
      return `username:${item.username}, _id:${item._id}`;
    });
    res.json(obj);
  });
});






app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
