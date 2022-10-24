const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running on http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = async (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "BLOWFISH", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.userId = payload.userId;
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const selectUserQuery = `
    SELECT 
        *
    FROM 
        user
    WHERE 
        username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `
            INSERT INTO 
                user(name,username,password,gender)
            VALUES
                ('${name}','${username}','${hashedPassword}','${gender}');`;
      const dbResponse = await db.run(createUserQuery);
      response.send("User created successfully");
    }
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT 
        *
    FROM 
        user
    WHERE 
        username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const userId = dbUser.user_id;
      const jwtToken = await jwt.sign({ userId }, "BLOWFISH");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const userId = request.userId;
  const getFeedQuery = `
    SELECT 
       user.username as username,
       tweet.tweet as tweet,    
       tweet.date_time as dateTime
    FROM 
        (user INNER JOIN follower
            ON user.user_id=follower.following_user_id)
            INNER JOIN tweet
            ON follower.following_user_id=tweet.user_id
    WHERE 
        follower.follower_user_id=${userId}
    ORDER BY 
        tweet.date_time DESC
    LIMIT 4;`;
  const feed = await db.all(getFeedQuery);
  response.send(feed);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  const userId = request.userId;
  const getFollowingQuery = `
    SELECT 
        user.name as name
    FROM 
        user INNER JOIN follower 
        ON user.user_id=follower.following_user_id
    WHERE
        follower.follower_user_id=${userId};`;
  const following = await db.all(getFollowingQuery);
  response.send(following);
});
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const userId = request.userId;
  const getFollowersQuery = `
    SELECT 
        user.name as name
    FROM 
        user INNER JOIN follower 
        ON user.user_id=follower.follower_user_id
    WHERE
        follower.following_user_id=${userId};`;
  const followers = await db.all(getFollowersQuery);
  response.send(followers);
});
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const userId = request.userId;
  const selectTweetQuery = `
    SELECT 
        *
    FROM 
        follower INNER JOIN tweet
        ON follower.following_user_id=tweet.user_id
    WHERE 
        (follower.follower_user_id=${userId} or tweet.user_id=${userId})and
        tweet.tweet_id=${tweetId};`;
  const dbTweet = await db.get(selectTweetQuery);
  if (dbTweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const getTweetQuery = `
        SELECT 
            tweet.tweet as tweet,
            COUNT(
                CASE
                    WHEN like.like_id NOT NULL THEN 1
                    END) as likes,
            COUNT(
                CASE
                    WHEN reply.reply_id NOT NULL THEN 1
                    END) as replies,
            tweet.date_time as dateTime
        FROM 
            (tweet LEFT JOIN like 
            ON tweet.tweet_id=like.tweet_id)
            LEFT JOIN reply
            ON tweet.tweet_id=reply.tweet_id
        GROUP BY 
            tweet.tweet_id
        HAVING 
            tweet.tweet_id=${tweetId};`;
    const tweet = await db.get(getTweetQuery);
    response.send(tweet);
  }
});
app.get(
  "/tweets/:tweetId/likes",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const userId = request.userId;
    const selectTweetQuery = `
    SELECT 
        *
    FROM 
        follower INNER JOIN tweet
        ON follower.following_user_id=tweet.user_id
    WHERE 
        (follower.follower_user_id=${userId} or tweet.user_id=${userId})and
        tweet.tweet_id=${tweetId};`;
    const dbTweet = await db.get(selectTweetQuery);
    if (dbTweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getUsersQuery = `
      SELECT 
        user.username as username
    FROM 
        user INNER JOIN like
        ON user.user_id=like.user_id
    WHERE 
        like.tweet_id=${tweetId} ;`;

      const likes = await db.all(getUsersQuery);
      response.send({
        likes: likes.map((item) => item.username),
      });
    }
  }
);
app.get(
  "/tweets/:tweetId/replies",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const userId = request.userId;
    const selectTweetQuery = `
    SELECT 
        *
    FROM 
        follower INNER JOIN tweet
        ON follower.following_user_id=tweet.user_id
    WHERE 
        (follower.follower_user_id=${userId} or tweet.user_id=${userId})and
        tweet.tweet_id=${tweetId};`;
    const dbTweet = await db.get(selectTweetQuery);
    if (dbTweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getUsersQuery = `
      SELECT 
        user.name as name,
        reply.reply as reply
    FROM 
        user INNER JOIN reply
        ON user.user_id=reply.user_id
    WHERE 
        reply.tweet_id=${tweetId};`;

      const replies = await db.all(getUsersQuery);
      response.send({
        replies: replies.map((item) => {
          return {
            name: item.name,
            reply: item.reply,
          };
        }),
      });
    }
  }
);
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const userId = request.userId;
  const getTweetsQuery = `
        SELECT 
            tweet.tweet as tweet,
            COUNT(
                CASE
                    WHEN like.like_id NOT NULL THEN 1
                    END) as likes,
            COUNT(
                CASE
                    WHEN reply.reply_id NOT NULL THEN 1
                    END) as replies,
            tweet.date_time as dateTime
        FROM 
            (tweet LEFT JOIN like 
            ON tweet.tweet_id=like.tweet_id)
            LEFT JOIN reply
            ON tweet.tweet_id=reply.tweet_id
        GROUP BY 
            tweet.tweet_id
        HAVING 
            tweet.user_id=${userId};`;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const userId = request.userId;
  const { tweet } = request.body;
  const createTweetQuery = `
    INSERT INTO 
        tweet(tweet,user_id)
    VALUES
        ('${tweet}',${userId});`;
  const dbResponse = await db.run(createTweetQuery);
  response.send("Created a Tweet");
});
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const userId = request.userId;
    const selectTweetQuery = `
    SELECT 
        *
    FROM 
        tweet
    WHERE 
        user_id=${userId} and
        tweet_id=${tweetId};`;
    const dbTweet = await db.get(selectTweetQuery);
    if (dbTweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteTweetQuery = `
        DELETE FROM tweet
        WHERE 
            tweet_id=${tweetId}`;
      const dbResponse = await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    }
  }
);
module.exports = app;
