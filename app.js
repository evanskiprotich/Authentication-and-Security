require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require("passport-google-oauth2").Strategy;
const findOrCreate = require("mongoose-findorcreate");
// const strategy = require("passport-facebook");
// const FacebookStrategy = strategy.Strategy;

//const encrypt = require("mongoose-encryption");
//const md5 = require("md5");
// const bcrypt = require("bcrypt");
// const saltRounds = 10

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));

//Session
app.use(session({
  secret: "Our Little Secret.",
  resave: false,
  saveUninitialized: false
}));

//Initialization of passport
app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

//use passport-local-mongoose as plugin
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

//encryption
//userSchema.plugin(encrypt, { secret: process.env.SECRET, encryptedFields: ["password"] });

const User = new mongoose.model("User", userSchema);

//use the initialized passport
passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user)
  })
})

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL:"https://www.googleapis.com/auth2/v3/userinfo",
      passReqToCallback: true,
    },
    function (request, accessToken, refreshToken, profile, done) {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return done(err, user);
      });
    }
  )
);

// passport.use(
//   new FacebookStrategy(
//     {
//       clientID: process.env.APP_ID,
//       clientSecret: process.env.APP_SECRET,
//       callbackURL: "http://localhost:3000/auth/facebook",
//       profileFields: ["email", "name"],
//     },
//     function (accessToken, refreshToken, profile, done) {
//       const { email, first_name, last_name } = profile._json;
//       const user = {
//         email,
//         firstName: first_name,
//         lastName: last_name,
//       };
//       new User(user).save();
//       done(null, profile);
//     }
//   )
// );


app.get("/", function (req, res) {
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate("google", {
    successRedirect: "/secrets",
    failureRedirect: "/login",
  })
);


//FACEBOOK API
// app.get(
//   "/auth/facebook",
//   passport.authenticate("facebook", { scope: ["email", "profile"] })
// );

// app.get(
//   "/auth/facebook/serets",
//   passport.authenticate("facebook", {
//     successRedirect: "/secrets",
//     failureRedirect: "/login",
//   })
// );
app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

//using passport to see if user is registered
app.get('/secrets', function (req, res){
  User.find({ secret: { $ne: null }}, function (err, user) {
    if(err){
      console.log(err);
    } else {
      if(user){
        res.render('secrets', {usersWithSecret:user})
      }
    }
  });
});
//submit
app.get('/submit', function (req, res){
   if (req.isAuthenticated()) {
     res.render("submit");
   } else {
     res.redirect("/login");
   }
});

app.post('/submit', function(req, res){
  const secretSubmitted = req.body.secret;

  User.findById(req.user.id, function(err, user){
    if (err) {
      console.log(err);
    } else{
      if(user){
        user.secret = secretSubmitted;
        user.save(function(){
          res.redirect("/secrets");
        });
      }
    }
  })
})

//logout
app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
})

//use passport to register user
 app.post('/register', function(req, res) {
   //register user using passport
    User.register(new User({ username : req.body.username }), req.body.password, function(err, account) {
        if (err) {
            return res.render('register', { account : account });
        }

        passport.authenticate('local')(req, res, function () {
          res.redirect('/secrets');
        });
    });
  });

  // bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
  //   const newUser = new User({
  //     email: req.body.username,
  //     password: hash,
  //   });

  //   newUser.save(function (err) {
  //     if (err) {
  //       console.log(err);
  //     } else {
  //       res.render("secrets");
  //     }
  //   });
  // });


//User login using passport
app.post("/login", function (req, res) {
  //create a new user
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
//login user using passport
  req.login(user, function (err){
    if(err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });


  // const username = req.body.username;
  // const password = req.body.password;

  // User.findOne({ email: username }, function (err, user) {
  //   if (err) {
  //     log.error(err);
  //   } else {
  //     if (user) {
  //       bcrypt.compare(password, user.password, function(err, result) {
  //   if (result=== true) {
  //      res.render("secrets");
  //   }
  //     });
         
  //       }
  //     }
  // });
});

app.listen(3000, function () {
  console.log("Server started at port 3000");
});
