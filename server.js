const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const app = express();
// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cookieParser());
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));
app.set('view engine', 'ejs');

// Create MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Thathagaru@50',
    database: 'medical'
});
// Connect to MySQL
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to database');
});

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const fieldName = file.fieldname; // The fieldname such as prescriptions, medical_report, additional_documents
    cb(null, `${req.session.userId}-${fieldName}-${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage: storage });

// Middleware to check if the user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Routes
app.get('/', (req, res) => {
    res.redirect('/index');
});

// Routes for index Page
app.get('/index', (req, res) => {
  res.render('index');
});

// Routes for registration page
app.get('/createprofile', (req, res) => {
  res.render('createprofile');
});

app.post('/createprofile', async (req, res) => {
  const { firstName, lastName, gender, dob, mobile, email, bloodGroup, emergencyContact, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const profileData = { firstName, lastName, gender, dob, mobile, email, bloodGroup, emergencyContact, password: hashedPassword };

  connection.query('INSERT INTO Profile SET ?', profileData, (error, results) => {
      if (error) {
          console.error('Error inserting profile data:', error);
          res.status(500).send('Error inserting profile data');
          return;
      }
      res.redirect('/login');
  });
});

// Routes for login page
app.get('/login', (req, res) => {
  res.render('login', { error: null }); // Pass error as null initially
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  connection.query('SELECT * FROM Profile WHERE email = ?', [email], async (error, results) => {
    if (error) {
      console.error('Error fetching user:', error);
      res.status(500).send('Error logging in');
      return;
    }
    if (results.length === 0 || !(await bcrypt.compare(password, results[0].password))) {
      res.status(401).send('Invalid email or password');
      return;
    }
    req.session.userId = results[0].id;
    res.redirect('/home');
  });
});

// Routes for home page
app.get('/home', isAuthenticated, (req, res) => {
  res.render('home');
});

// Routes for profile page
app.get('/profile', isAuthenticated, (req, res) => {
  connection.query('SELECT * FROM Profile WHERE id = ?', [req.session.userId], (error, results) => {
    if (error) {
      console.error('Error fetching user details:', error);
      res.status(500).send('Error fetching user details');
      return;
    }
    if (results.length === 0) {
      res.status(404).send('User not found');
      return;
    }
    res.render('profile', { user: results[0] });
  });
});

// Routes for form page
app.get('/form', isAuthenticated, (req, res) => {
  res.render('form');
});

app.post('/form', isAuthenticated, upload.fields([
  { name: 'prescriptions', maxCount: 1 },
  { name: 'medical_report', maxCount: 1 },
  { name: 'additional_documents', maxCount: 1 }
]), (req, res) => {
  const { consultation_date, hospital_name, doctor_name, doctor_specialisation, next_consultation_date } = req.body;
  const prescriptions = req.files['prescriptions'] ? req.files['prescriptions'][0].path : null;
  const medical_report = req.files['medical_report'] ? req.files['medical_report'][0].path : null;
  const additional_documents = req.files['additional_documents'] ? req.files['additional_documents'][0].path : null;

  const sql = 'INSERT INTO consultation_records (user_id, consultation_date, hospital_name, doctor_name, doctor_specialisation, prescriptions, medical_report, next_consultation_date, additional_documents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const values = [req.session.userId, consultation_date, hospital_name, doctor_name, doctor_specialisation, prescriptions, medical_report, next_consultation_date, additional_documents];

  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error inserting data:', err.stack);
      res.status(500).send('Error submitting form.');
      return;
    }
    res.render('success');
  });
});

// Routes for file page
app.get('/file', isAuthenticated, (req, res) => {
  const sql = 'SELECT * FROM consultation_records WHERE user_id = ?';
  connection.query(sql, [req.session.userId], (error, results) => {
    if (error) {
      console.error('Error fetching user files:', error);
      res.status(500).send('Error fetching user files');
      return;
    }
    res.render('file', { records: results });
  });
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
