CREATE TABLE organisations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('admin','auditor','client')),
  organisation_id INT REFERENCES organisations(id)
);

CREATE TABLE controls (
  id SERIAL PRIMARY KEY,
  control_id VARCHAR(10) UNIQUE NOT NULL,   -- e.g. A.5.1
  theme VARCHAR(20) NOT NULL CHECK (theme IN
    ('Organizational','People','Physical','Technological')),
  title VARCHAR(200) NOT NULL
);

CREATE TABLE audits (
  id SERIAL PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  auditor_id INT REFERENCES users(id),
  client_org_id INT REFERENCES organisations(id),
  status VARCHAR(20) DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_controls (
  id SERIAL PRIMARY KEY,
  audit_id INT REFERENCES audits(id) ON DELETE CASCADE,
  control_id INT REFERENCES controls(id),
  client_explanation TEXT,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','submitted','more_evidence','C','NA','PC','NC')),
  auditor_comment TEXT,
  UNIQUE (audit_id, control_id)
);

CREATE TABLE evidence (
  id SERIAL PRIMARY KEY,
  audit_control_id INT REFERENCES audit_controls(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  file_path VARCHAR(255),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE findings (
  id SERIAL PRIMARY KEY,
  audit_control_id INT REFERENCES audit_controls(id) ON DELETE CASCADE,
  severity VARCHAR(10) CHECK (severity IN ('low','medium','high')),
  description TEXT,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'open'
    CHECK (status IN ('open','resolved')),
  created_at TIMESTAMP DEFAULT NOW()
);