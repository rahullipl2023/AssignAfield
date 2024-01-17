// middlewares/authMiddleware.js
const passport = require('passport');
const jwt = require('jsonwebtoken');

const requireAuth = passport.authenticate(process.env.JWT_SECRET, { session: false });

async function  checkToken (req, res, next)  {
  // Middleware to check if the request has a valid JWT token
  requireAuth(req, res, (err) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });
};

async function generateToken  (user)  {
  // You can customize the token payload as needed
  const payload = {
    userId: user._id,
    username: user.email,
    // Add other user-related information if needed
  };

  // Replace 'your-secret-key' with a secret key for signing the token
  const secretKey = process.env.JWT_SECRET;

  // Set the expiration time for the token (e.g., 1 hour)
  const expiresIn = '8h';

  return jwt.sign(payload, secretKey, { expiresIn });
  // let dat =  jwt.sign(payload, secretKey, { expiresIn });
  // console.log(dat,"vvvvvvvvvvvv");
};

const verifyToken = (req, res, next) => {
  // Get the token from the request headers
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Token not provided' });
  }

  // Replace 'your-secret-key' with the same secret key used for signing the token
  const secretKey = process.env.JWT_SECRET;

  // Verify and decode the token
  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Attach the decoded payload to the request object for later use
    req.user = decoded;

    // Continue with the next middleware or route handler
    next();
  });
};

module.exports = { requireAuth, checkToken, generateToken, verifyToken };
