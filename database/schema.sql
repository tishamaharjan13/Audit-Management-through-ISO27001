-- ORGANISATIONS & USERS
CREATE TABLE organisations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  org_type VARCHAR(15) NOT NULL DEFAULT 'client'
    CHECK (org_type IN ('audit_firm','client')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('admin','auditor','client')),
  organisation_id INT REFERENCES organisations(id),
  is_active BOOLEAN DEFAULT TRUE,
  failed_logins INT DEFAULT 0,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE
);

-- ANNEX A CONTROLS (ID, theme, short title only)
CREATE TABLE controls (
  id SERIAL PRIMARY KEY,
  control_id VARCHAR(10) UNIQUE NOT NULL,   -- e.g. A.5.1
  theme VARCHAR(20) NOT NULL CHECK (theme IN
    ('Organizational','People','Physical','Technological')),
  title VARCHAR(200) NOT NULL
);

-- AUDITS
CREATE TABLE audits (
  id SERIAL PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  scope TEXT,
  auditor_id INT NOT NULL REFERENCES users(id),
  client_org_id INT NOT NULL REFERENCES organisations(id),
  status VARCHAR(20) DEFAULT 'in_progress'
    CHECK (status IN ('draft','in_progress','completed','closed')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

-- one row per control selected for an audit
CREATE TABLE audit_controls (
  id SERIAL PRIMARY KEY,
  audit_id INT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  control_id INT NOT NULL REFERENCES controls(id),
  workflow_status VARCHAR(20) DEFAULT 'pending'
    CHECK (workflow_status IN
      ('pending','submitted','more_evidence','evaluated','remediation')),
  result VARCHAR(2) CHECK (result IN ('C','NA','PC','NC')),  -- NULL until evaluated
  client_explanation TEXT,
  auditor_comment TEXT,
  submitted_at TIMESTAMP,
  evaluated_by INT REFERENCES users(id),
  evaluated_at TIMESTAMP,
  UNIQUE (audit_id, control_id)
);

-- FINDINGS & REMEDIATION (PC / NC only)
CREATE TABLE findings (
  id SERIAL PRIMARY KEY,
  audit_control_id INT NOT NULL REFERENCES audit_controls(id) ON DELETE CASCADE,
  severity VARCHAR(10) CHECK (severity IN ('low','medium','high')),
  description TEXT,
  due_date DATE,
  status VARCHAR(25) DEFAULT 'open'
    CHECK (status IN ('open','remediation_submitted','resolved')),
  escalation_level INT DEFAULT 0,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- each corrective-action attempt by the client (the loop in Figure 1)
CREATE TABLE remediation_submissions (
  id SERIAL PRIMARY KEY,
  finding_id INT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  round_no INT DEFAULT 1,
  client_response TEXT,
  submitted_by INT REFERENCES users(id),
  submitted_at TIMESTAMP DEFAULT NOW(),
  verified BOOLEAN,                  -- NULL = waiting for auditor
  auditor_feedback TEXT,
  verified_at TIMESTAMP
);

-- EVIDENCE (for the first assessment or for a remediation round)
CREATE TABLE evidence (
  id SERIAL PRIMARY KEY,
  audit_control_id INT NOT NULL REFERENCES audit_controls(id) ON DELETE CASCADE,
  remediation_id INT REFERENCES remediation_submissions(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size INT,
  uploaded_by INT REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- NOTIFICATIONS (in-app + email log)
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audit_id INT REFERENCES audits(id) ON DELETE CASCADE,
  type VARCHAR(30),       -- finding_created, more_evidence, deadline, etc.
  subject VARCHAR(200),
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- SHARED CALENDAR
CREATE TABLE calendar_events (
  id SERIAL PRIMARY KEY,
  audit_id INT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  finding_id INT REFERENCES findings(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  event_type VARCHAR(20) DEFAULT 'activity'
    CHECK (event_type IN ('activity','remediation_deadline','meeting')),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  created_by INT REFERENCES users(id)
);

-- AI READINESS ANALYSIS (template now, real LLM later)
CREATE TABLE ai_analyses (
  id SERIAL PRIMARY KEY,
  audit_id INT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  readiness_score NUMERIC(5,2),
  summary TEXT,
  gaps JSONB,               -- list of gaps
  recommendations JSONB,    -- prioritised recommendations
  model_used VARCHAR(50) DEFAULT 'template',
  reviewed_by INT REFERENCES users(id),   -- auditor must review AI output
  review_note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- FINAL REPORTS
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  audit_id INT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  generated_by INT REFERENCES users(id),
  summary TEXT,
  file_path VARCHAR(255),
  management_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ACTIVITY LOG (traceability + security)
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  audit_id INT REFERENCES audits(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,     -- login, create_audit, evaluate_control...
  entity VARCHAR(30),
  entity_id INT,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_audit_controls_audit ON audit_controls(audit_id);
CREATE INDEX idx_evidence_ac ON evidence(audit_control_id);
CREATE INDEX idx_findings_ac ON findings(audit_control_id);
CREATE INDEX idx_notif_user ON notifications(user_id, is_read);
CREATE INDEX idx_calendar_audit ON calendar_events(audit_id);
CREATE INDEX idx_logs_audit ON audit_logs(audit_id);

-- VIEWS FOR PROGRESS + GRAPHS (bar / pie)
-- Pie chart + progress: count of each result per audit
CREATE VIEW v_audit_progress AS
SELECT
  a.id AS audit_id,
  COUNT(ac.id) AS total_controls,
  COUNT(*) FILTER (WHERE ac.result = 'C')  AS compliant,
  COUNT(*) FILTER (WHERE ac.result = 'NA') AS not_applicable,
  COUNT(*) FILTER (WHERE ac.result = 'PC') AS partially_compliant,
  COUNT(*) FILTER (WHERE ac.result = 'NC') AS non_compliant,
  COUNT(*) FILTER (WHERE ac.result IS NULL) AS not_evaluated,
  ROUND(100.0 * COUNT(*) FILTER (WHERE ac.result IS NOT NULL)
        / NULLIF(COUNT(ac.id),0), 1) AS progress_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE ac.result = 'C')
        / NULLIF(COUNT(*) FILTER (WHERE ac.result IN ('C','PC','NC')),0), 1)
        AS compliance_pct          -- N/A excluded; PC counts as 0
FROM audits a
LEFT JOIN audit_controls ac ON ac.audit_id = a.id
GROUP BY a.id;

-- Bar chart: results per theme
CREATE VIEW v_theme_results AS
SELECT
  ac.audit_id,
  c.theme,
  COUNT(*) FILTER (WHERE ac.result = 'C')  AS compliant,
  COUNT(*) FILTER (WHERE ac.result = 'NA') AS not_applicable,
  COUNT(*) FILTER (WHERE ac.result = 'PC') AS partially_compliant,
  COUNT(*) FILTER (WHERE ac.result = 'NC') AS non_compliant
FROM audit_controls ac
JOIN controls c ON c.id = ac.control_id
GROUP BY ac.audit_id, c.theme;