const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authMiddleWare = (req, res, next) => {
  let jwtToken;
  //let { stateId = 1 } = req.params;
  //console.log(stateId);
  let reqHeder = req.headers["authorization"];
  if (reqHeder != undefined) {
    jwtToken = reqHeder.split(" ")[1];
  }
  if (reqHeder == undefined) {
    res.status(401);
    res.send("Invalid JWTt Token");
  }
  if (jwtToken == undefined) {
    res.status(401);
    res.send("Invalid JWTt Token");
  } else {
    jwt.verify(jwtToken, "encrypted", async (error, user) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        //req.username = user.username;
        next();
      }
    });
  }
};

// get  states

app.get("/states/", authMiddleWare, async (req, res) => {
  let { username } = req;
  //console.log(username);
  const query = `select * from state;`;
  const dbres = await db.all(query);
  //res.send(dbres);
  res.send(
    dbres.map((each) => ({
      stateId: each.state_id,
      stateName: each.state_name,
      population: each.population,
    }))
  );
});

//2.api get states with state id

app.get("/states/:stateId/", authMiddleWare, async (req, res) => {
  let { username } = req;
  const { stateId } = req.params;
  //console.log(username);
  const query = `select * from state where state_id=${stateId};`;
  const dbres = await db.get(query);
  //res.send(dbres);
  res.send({
    stateId: dbres.state_id,
    stateName: dbres.state_name,
    population: dbres.population,
  });
});

//api..4....post into districts

app.post("/districts/", authMiddleWare, async (req, res) => {
  const districtDetails = req.body;
  const {
    stateId,
    districtName,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const dbQuery = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
    VALUES(
        '${districtName}',${stateId},${cases},${cured},${active},${deaths}
        );`;
  const dbRes = await db.run(dbQuery);
  const district_id = dbRes.lastID;
  //console.log(districtName, stateId);
  res.send("District Successfully Added");
});

//api...5...Returns a district based on the district ID

app.get("/districts/:districtId/", authMiddleWare, async (req, res) => {
  const { districtId } = req.params;
  const dbQuery = `SELECT * FROM district WHERE district_id=${districtId}`;
  const dbRes = await db.get(dbQuery);
  res.send({
    districtId: dbRes.district_id,
    districtName: dbRes.district_name,
    stateId: dbRes.state_id,
    cases: dbRes.cases,
    cured: dbRes.cured,
    active: dbRes.active,
    deaths: dbRes.deaths,
  });
});

//api..6 delete distric on id

app.delete("/districts/:districtId/", authMiddleWare, async (req, res) => {
  const { districtId } = req.params;
  const dbQuery = `DELETE FROM district WHERE district_id=${districtId};`;
  const dbRes = await db.run(dbQuery);
  res.send("District Removed");
});

//api....7....update a district

app.put("/districts/:districtId/", authMiddleWare, async (req, res) => {
  const districtDetails = req.body;
  const { districtId } = req.params;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const dbQuery = `UPDATE district SET 
  district_name='${districtName}',
  state_id=${stateId},cases=${cases},
  cured=${cured},
  active=${active},deaths=${deaths} WHERE district_id=${districtId}`;
  const dbRes = await db.run(dbQuery);
  res.send("District Details Updated");
});

// api...8... Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID

app.get("/states/:stateId/stats/", authMiddleWare, async (req, res) => {
  const { stateId } = req.params;
  const dbQuery = `SELECT 
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths FROM district WHERE state_id=${stateId};`;
  const dbRes = await db.get(dbQuery);
  res.send(dbRes);
});

///1..register APi

app.post("/register/", async (req, res) => {
  const { username, name, password, gender, location } = req.body;
  const encrPassword = await bcrypt.hash(password, 10);
  const dbUserQuery = `select * from user where username='${username}'`;
  const dbUser = await db.get(dbUserQuery);
  if (dbUser == undefined) {
    if (password.length < 5) {
      res.status(400);
      res.send("Password is too short");
    } else {
      const addUserQuery = `insert into 
      user(username, name, password, gender, location) values(
          '${username}', 
          '${name}',
          '${encrPassword}', 
          '${gender}',
          '${location}'
      )`;
      const dbRes = await db.run(addUserQuery);
      const newUserId = dbRes.lastID;
      res.send("User created successfully");
    }
  } else {
    res.status(400);
    res.send("User already exists");
  }
});

//2.......login api

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const dbUserQuery = `select * from user where username='${username}'`;
  const dbRes = await db.get(dbUserQuery);
  if (dbRes == undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const checkPassword = await bcrypt.compare(password, dbRes.password);
    if (checkPassword) {
      //res.send("Login success!");
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "encrypted");
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

module.exports = app;
