const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
const dbPath = path.join(__dirname, "moviesData.db");
app.use(express.json());
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running on http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

app.get("/movies/", async (request, response) => {
  const getMoviesQuery = `
    SELECT 
        *
    FROM
        movie
    ORDER BY 
        movie_id;`;
  const movies = await db.all(getMoviesQuery);
  response.send(
    movies.map((item) => {
      return {
        movieName: item.movie_name,
      };
    })
  );
});

app.post("/movies/", async (request, response) => {
  const { directorId, movieName, leadActor } = request.body;
  const postMovieQuery = `
    INSERT INTO
        movie(director_id,movie_name,lead_actor)
    VALUES
        (${directorId},'${movieName}','${leadActor}');`;
  const dbResponse = await db.run(postMovieQuery);
  response.send("Movie Successfully Added");
});

app.get("/movies/:movieId/", async (request, response) => {
  const { movieId } = request.params;
  const getMovieQuery = `
    SELECT 
        *
    FROM 
        movie
    WHERE 
        movie_id=${movieId};`;
  const movie = await db.get(getMovieQuery);
  response.send(movie);
});

app.put("/movies/:movieId/", async (request, response) => {
  const { movieId } = request.params;
  const { directorId, movieName, leadActor } = request.body;
  const putMovieQuery = `
    UPDATE movie
    SET 
        director_id=${directorId},
        movie_name='${movieName}',
        lead_actor='${leadActor}'
    WHERE
        movie_id=${movieId};`;
  const dbResponse = await db.run(putMovieQuery);
  response.send("Movie Details Updated");
});
app.delete("/movies/:movieId/", async (request, response) => {
  const { movieId } = request.params;
  const deleteMovieQuery = `
    DELETE FROM movie
    WHERE 
        movie_id=${movieId};`;
  const dbResponse = await db.run(deleteMovieQuery);
  response.send("Movie Removed");
});

app.get("/directors/", async (request, response) => {
  const getDirectorsQuery = `
    SELECT 
        *
    FROM 
        movie
    ORDER BY 
        director_id;`;
  const directors = await db.all(getDirectorsQuery);
  response.send(
    directors.map((item) => {
      return {
        directorId: item.director_id,
        directorName: item.director_name,
      };
    })
  );
});

app.get("/directors/:directorId/movies/", async (request, response) => {
  const { directorId } = request.params;
  const getMoviesQuery = `
    SELECT 
        *
    FROM 
        movie
    WHERE 
        director_id=${directorId};`;
  const movies = await db.all(getMoviesQuery);
  response.send(
    movies.map((item) => {
      return {
        movieName: item.movie_name,
      };
    })
  );
});

module.exports = app;
