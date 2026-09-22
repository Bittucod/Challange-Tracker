require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Admin authentication middleware
const requireAdminAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const customHeader = req.headers['x-admin-password'];
  const queryToken = req.query.key;

  let providedPassword = customHeader || queryToken;

  if (!providedPassword && authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      providedPassword = authHeader.substring(7);
    } else {
      providedPassword = authHeader;
    }
  }

  if (!providedPassword || providedPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or missing admin password'
    });
  }

  next();
};

// URL validator helper
function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

// Phone cleaner helper
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

// ----------------------------------------------------
// PUBLIC API ENDPOINTS
// ----------------------------------------------------

// POST /api/apply - Save video editor application
app.post('/api/apply', async (req, res) => {
  try {
    const {
      full_name,
      address_city,
      experience,
      past_channels,
      never_worked_before,
      whatsapp,
      alt_phone,
      telegram,
      instagram,
      skills,
      task_link
    } = req.body;

    // Validation
    const errors = [];

    if (!full_name || !full_name.trim()) {
      errors.push('Full Name is required.');
    }

    if (!experience || !['Beginner', '1-2 Years', '3+ Years'].includes(experience)) {
      errors.push('Please select a valid experience level (Beginner, 1-2 Years, or 3+ Years).');
    }

    if (!whatsapp || !whatsapp.trim()) {
      errors.push('WhatsApp Number is mandatory.');
    } else {
      const cleaned = cleanPhoneNumber(whatsapp);
      if (cleaned.length < 8) {
        errors.push('Please enter a valid WhatsApp number including country code.');
      }
    }

    if (!task_link || !task_link.trim()) {
      errors.push('Edited Task Submission Link is mandatory.');
    } else if (!isValidHttpUrl(task_link.trim())) {
      errors.push('Task submission link must be a valid URL (e.g. Google Drive, YouTube, Dropbox).');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors
      });
    }

    // Insert into DB
    const newApplication = await db.createApplication({
      full_name,
      address_city,
      experience,
      past_channels,
      never_worked_before: Boolean(never_worked_before),
      whatsapp: cleanPhoneNumber(whatsapp),
      alt_phone: cleanPhoneNumber(alt_phone),
      telegram,
      instagram,
      skills,
      task_link
    });

    console.log(`[New Application] #${newApplication.id} submitted by "${newApplication.full_name}"`);

    return res.status(201).json({
      success: true,
      message: 'Your application has been received successfully! Our team will review your edit and contact you via WhatsApp.',
      applicationId: newApplication.id
    });
  } catch (error) {
    console.error('Error in /api/apply:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while saving your application. Please try again.'
    });
  }
});

// ----------------------------------------------------
// ADMIN API ENDPOINTS (Protected)
// ----------------------------------------------------

// POST /api/admin/verify - Verify admin password
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, message: 'Authenticated successfully' });
  }
  return res.status(401).json({ success: false, message: 'Invalid admin password' });
});

// GET /api/admin/stats - Overview metrics
app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch metrics' });
  }
});

// GET /api/admin/applications - List all applications with optional search and filters
app.get('/api/admin/applications', requireAdminAuth, async (req, res) => {
  try {
    const { status, experience, search } = req.query;
    const applications = await db.getApplications({ status, experience, search });
    res.json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve applications' });
  }
});

// GET /api/admin/applications/:id - Single application
app.get('/api/admin/applications/:id', requireAdminAuth, async (req, res) => {
  try {
    const appData = await db.getApplicationById(req.params.id);
    if (!appData) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({ success: true, application: appData });
  } catch (error) {
    console.error('Error fetching application detail:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch application' });
  }
});

// PATCH /api/admin/applications/:id - Update status or reviewer notes
app.patch('/api/admin/applications/:id', requireAdminAuth, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['Pending', 'Reviewing', 'Shortlisted', 'Hired', 'Rejected'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updated = await db.updateApplication(req.params.id, { status, notes });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    res.json({
      success: true,
      message: 'Application updated successfully',
      application: updated
    });
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({ success: false, message: 'Failed to update application' });
  }
});

// DELETE /api/admin/applications/:id - Delete an application
app.delete('/api/admin/applications/:id', requireAdminAuth, async (req, res) => {
  try {
    const deleted = await db.deleteApplication(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    res.json({
      success: true,
      message: `Application #${req.params.id} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ success: false, message: 'Failed to delete application' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() });
});

// Fallback for SPA routing if needed
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start Server with graceful fallback if port is occupied
const startServer = (portToTry) => {
  const server = app.listen(portToTry, () => {
    console.log('====================================================');
    console.log(`🎬 Video Editor Hiring Portal is running!`);
    console.log(`🌐 Public Landing Page: http://localhost:${portToTry}`);
    console.log(`🔒 Admin Dashboard:    http://localhost:${portToTry}/admin.html`);
    console.log(`🔑 Admin Password:     ${ADMIN_PASSWORD}`);
    console.log('====================================================');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Notice] Port ${portToTry} is in use. Trying port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('Server error:', err);
    }
  });
};

db.initDb().then(() => {
  startServer(Number(PORT));
}).catch(err => {
  console.error('Failed to initialize database. Server not started.', err);
});
