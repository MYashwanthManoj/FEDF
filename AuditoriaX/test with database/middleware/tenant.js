const Institution = require('../models/Institution');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * resolveTenant — reads the authenticated user's institutionId and attaches
 * the full institution document to `req.institution`.
 *
 * If the user has no institutionId (platform admin, or unaffiliated student),
 * req.institution will be null — downstream routes must handle this.
 *
 * Must be called AFTER verifyToken (req.user must exist).
 */
async function resolveTenant(req, res, next) {
  try {
    // Platform admin never needs a tenant context
    if (req.user.role === 'admin') {
      req.institution = null;
      return next();
    }

    // Get the full user to find their institutionId
    const user = await User.findById(req.user.id).lean();
    if (!user || !user.institutionId) {
      req.institution = null;
      return next();
    }

    const institution = await Institution.findById(user.institutionId).lean();
    if (!institution) {
      req.institution = null;
      return next();
    }

    if (institution.status === 'suspended') {
      return res.status(403).json({
        error: 'Your institution has been suspended. Please contact platform support.'
      });
    }

    req.institution = institution;
    req.institutionId = institution._id;
    return next();
  } catch (err) {
    logger.error('Tenant resolution error', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * requireTenant — ensures the request has a valid institution context.
 * Use after resolveTenant for routes that MUST operate within a tenant.
 */
function requireTenant(req, res, next) {
  // Platform admin bypasses tenant requirement
  if (req.user.role === 'admin') return next();

  if (!req.institution) {
    return res.status(403).json({
      error: 'You must be affiliated with an institution to perform this action. Register or join an institution first.'
    });
  }
  return next();
}

/**
 * requireInstitutionAdmin — ensures the user is the owner of their institution
 * or a platform admin. Used for institution management routes.
 */
function requireInstitutionAdmin(req, res, next) {
  if (req.user.role === 'admin') return next();

  if (req.user.role === 'institution_admin' && req.institution) {
    return next();
  }

  return res.status(403).json({
    error: 'Access denied. Institution Admin or Platform Admin required.'
  });
}

module.exports = { resolveTenant, requireTenant, requireInstitutionAdmin };
