import React, { useState, useMemo, useEffect } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Clock,
  UploadCloud,
  RefreshCw,
  Cpu,
  BarChart3,
  UserCheck,
  Mail,
  ArrowRight,
  Eye,
  ChevronRight,
  Lock,
  Check,
  PlayCircle,
  PlusCircle,
  Search,
  Filter,
  KeyRound,
  LogOut,
  Settings,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { request } from "../services/authService";
// ISO 27001:2022 Initial Seed Data
const INITIAL_CONTROLS = [
  {
    id: "A.5.1",
    category: "Organizational",
    title: "Policies for information security",
    status: "C",
    evidence: "ISMS_Policy_v2.1.pdf",
    remarks: "Approved by board on Jan 2026.",
    remediation: null,
  },
  {
    id: "A.5.7",
    category: "Organizational",
    title: "Threat intelligence",
    status: "PC",
    evidence: "Feeds_Config.png",
    remarks:
      "Intelligence gathered manually; lacking automated SOC integration.",
    remediation: {
      task: "Integrate automated threat feed API into SIEM",
      deadline: "2026-09-15",
      status: "In Progress",
    },
  },
  {
    id: "A.5.23",
    category: "Organizational",
    title: "Information security for use of cloud services",
    status: "C",
    evidence: "Cloud_Vendor_Assessment.xlsx",
    remarks: "Annual third-party audit reports verified.",
    remediation: null,
  },
  {
    id: "A.6.1",
    category: "People",
    title: "Screening",
    status: "C",
    evidence: "HR_Screening_Process.pdf",
    remarks: "Background checks conducted for all new hires.",
    remediation: null,
  },
  {
    id: "A.6.3",
    category: "People",
    title: "Information security awareness, education and training",
    status: "NC",
    evidence: "",
    remarks: "No security awareness training conducted for Q1/Q2.",
    remediation: {
      task: "Roll out mandatory phishing & security training to all staff",
      deadline: "2026-09-10",
      status: "Pending Evidence",
    },
  },
  {
    id: "A.7.1",
    category: "Physical",
    title: "Physical security perimeters",
    status: "C",
    evidence: "Badge_Access_Logs.csv",
    remarks: "Keycard access restricted to authorized personnel.",
    remediation: null,
  },
  {
    id: "A.7.4",
    category: "Physical",
    title: "Physical security monitoring",
    status: "N/A",
    evidence: "",
    remarks: "Organization operates in a 100% remote work structure.",
    remediation: null,
  },
  {
    id: "A.8.8",
    category: "Technological",
    title: "Management of technical vulnerabilities",
    status: "NC",
    evidence: "Scan_Report_Jul.pdf",
    remarks: "Critical patch management policy SLA exceeded by 45 days.",
    remediation: {
      task: "Patch critical CVE-2026-1192 on core database servers",
      deadline: "2026-09-01",
      status: "Overdue",
    },
  },
  {
    id: "A.8.12",
    category: "Technological",
    title: "Data leakage prevention",
    status: "C",
    evidence: "DLP_Policy_Rules.json",
    remarks: "Endpoint DLP deployed and actively blocking outbound PII.",
    remediation: null,
  },
];
const ROLE_TABS = {
  admin: ["dashboard", "audits", "notifications", "report", "users"],
  auditor: ["dashboard", "controls", "remediation", "notifications", "report"],
  client: ["dashboard", "controls", "remediation", "notifications"],
};
export default function AuditPlatform() {
  const { user, logout } = useAuth();
  const [adminStats, setAdminStats] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

  const [clientStats, setClientStats] = useState(null);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState("");

  const [clientAudit, setClientAudit] = useState(null);
  const [clientAuditLoading, setClientAuditLoading] = useState(false);
  const [clientAuditError, setClientAuditError] = useState("");

  const [auditorStats, setAuditorStats] = useState(null);
  const [auditorLoading, setAuditorLoading] = useState(false);
  const [auditorError, setAuditorError] = useState("");

  const [auditorAudit, setAuditorAudit] = useState(null);
  const [auditorAuditLoading, setAuditorAuditLoading] = useState(false);
  const [auditorAuditError, setAuditorAuditError] = useState("");

  const [remediationFindings, setRemediationFindings] = useState([]);
  const [remediationLoading, setRemediationLoading] = useState(false);
  const [remediationError, setRemediationError] = useState("");
  const [remediationMessage, setRemediationMessage] = useState("");
  const [remediationResponses, setRemediationResponses] = useState({});
  const [remediationFiles, setRemediationFiles] = useState({});
  const [remediationFeedback, setRemediationFeedback] = useState({});
  const [remediationSavingId, setRemediationSavingId] = useState(null);

  const [adminAudits, setAdminAudits] = useState([]);
  const [adminAuditsLoading, setAdminAuditsLoading] = useState(false);
  const [adminAuditsError, setAdminAuditsError] = useState("");

  const [selectedAdminAudit, setSelectedAdminAudit] = useState(null);
  const [availableControls, setAvailableControls] = useState([]);
  const [selectedControlIds, setSelectedControlIds] = useState([]);
  const [addingControls, setAddingControls] = useState(false);
  const [controlsMessage, setControlsMessage] = useState("");

  const handleAddControls = async () => {
    if (!selectedAdminAudit || selectedControlIds.length === 0) {
      setControlsMessage("Please select at least one control.");
      return;
    }

    setAddingControls(true);
    setControlsMessage("");

    try {
      const result = await request(
        `/audits/${selectedAdminAudit.id}/controls`,
        {
          method: "POST",
          body: {
            control_ids: selectedControlIds,
          },
        },
      );

      setControlsMessage(result.message);

      // Refresh available controls after saving
      const updatedControls = await request(
        `/audits/${selectedAdminAudit.id}/controls`,
      );

      setAvailableControls(updatedControls);
      setSelectedControlIds([]);

      // Refresh audit list to update control counts
      const updatedAudits = await request("/audits");
      setAdminAudits(updatedAudits);
    } catch (error) {
      setControlsMessage(error.message);
    } finally {
      setAddingControls(false);
    }
  };

  const [evaluationModal, setEvaluationModal] = useState(null);
  const [findingDescription, setFindingDescription] = useState("");
  const [findingSeverity, setFindingSeverity] = useState("medium");
  const [findingDueDate, setFindingDueDate] = useState("");
  const [evaluationSaving, setEvaluationSaving] = useState(false);
  const [evaluationMessage, setEvaluationMessage] = useState("");
  useEffect(() => {
    if (user?.role !== "admin") return;

    let cancelled = false;

    setAdminLoading(true);
    setAdminError("");

    request("/dashboard/admin")
      .then((data) => {
        if (!cancelled) {
          setAdminStats(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAdminError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAdminLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") return;

    let cancelled = false;

    setAdminAuditsLoading(true);
    setAdminAuditsError("");

    request("/audits")
      .then((data) => {
        if (!cancelled) {
          setAdminAudits(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAdminAuditsError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAdminAuditsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  useEffect(() => {
    if (!selectedAdminAudit) {
      setAvailableControls([]);
      setSelectedControlIds([]);
      return;
    }

    let cancelled = false;

    setAvailableControls([]);
    setSelectedControlIds([]);
    setControlsMessage("");

    request(`/audits/${selectedAdminAudit.id}/controls`)
      .then((data) => {
        if (!cancelled) {
          setAvailableControls(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setControlsMessage(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAdminAudit]);

  useEffect(() => {
    if (user?.role !== "client") return;

    let cancelled = false;

    setClientLoading(true);
    setClientError("");

    request("/dashboard/client")
      .then((data) => {
        if (!cancelled) {
          setClientStats(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setClientError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setClientLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "auditor") return;

    let cancelled = false;

    setAuditorLoading(true);
    setAuditorError("");

    request("/dashboard/auditor")
      .then((data) => {
        if (!cancelled) {
          setAuditorStats(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAuditorError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuditorLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "auditor") return;

    let cancelled = false;

    setAuditorAuditLoading(true);
    setAuditorAuditError("");

    request("/auditor/audits")
      .then(async (audits) => {
        if (cancelled) return;

        if (!audits || audits.length === 0) {
          setAuditorAudit(null);
          return;
        }

        // Fetch the details and controls of the first assigned audit
        const data = await request(`/auditor/audits/${audits[0].id}`);

        if (!cancelled) {
          setAuditorAudit(data);

          const mappedControls = data.controls.map((control) => ({
            id: control.control_id,
            auditControlId: control.audit_control_id,
            category: control.theme,
            title: control.title,
            status:
              control.result === "NA" ? "N/A" : control.result || "Pending",
            evidence: control.client_explanation || "",
            evidenceFileName: control.evidence_file_name || "",
            evidenceFilePath: control.evidence_file_path || "",
            remarks: control.auditor_comment || "",
            remediation: null,
            workflowStatus: control.workflow_status,
          }));

          setControls(mappedControls);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAuditorAuditError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuditorAuditLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "client") return;

    const auditId = clientStats?.audit_list?.[0]?.id;

    if (!auditId) return;

    let cancelled = false;

    const loadClientAudit = async () => {
      setClientAuditLoading(true);
      setClientAuditError("");

      try {
        const data = await request(`/client/audits/${auditId}`);

        if (cancelled) return;

        setClientAudit(data);

        const mappedControls = data.controls.map((control) => ({
          id: control.control_id,
          auditControlId: control.audit_control_id,
          category: control.theme,
          title: control.title,
          status: control.result === "NA" ? "N/A" : control.result || "Pending",
          evidence: control.client_explanation || "",
          evidenceFileName: control.evidence_file_name || "",
          evidenceFilePath: control.evidence_file_path || "",
          remarks: control.client_explanation || "",
          remediation: null,
          workflowStatus: control.workflow_status,
        }));

        setControls(mappedControls);
      } catch (error) {
        if (!cancelled) {
          setClientAuditError(error.message);
        }
      } finally {
        if (!cancelled) {
          setClientAuditLoading(false);
        }
      }
    };

    loadClientAudit();

    return () => {
      cancelled = true;
    };
  }, [user?.role, clientStats?.audit_list?.[0]?.id]);

  useEffect(() => {
    if (user?.role !== "client") return;

    let cancelled = false;

    const loadRemediationFindings = async () => {
      setRemediationLoading(true);
      setRemediationError("");

      try {
        const data = await request("/client/audits/remediation/findings");

        if (!cancelled) {
          setRemediationFindings(data);
        }
      } catch (error) {
        if (!cancelled) {
          setRemediationError(error.message);
        }
      } finally {
        if (!cancelled) {
          setRemediationLoading(false);
        }
      }
    };

    loadRemediationFindings();

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "auditor") return;

    let cancelled = false;

    const loadAuditorRemediation = async () => {
      setRemediationLoading(true);
      setRemediationError("");

      try {
        const data = await request("/auditor/audits/remediation/findings");

        if (!cancelled) {
          setRemediationFindings(data);
        }
      } catch (error) {
        if (!cancelled) {
          setRemediationError(error.message);
        }
      } finally {
        if (!cancelled) {
          setRemediationLoading(false);
        }
      }
    };

    loadAuditorRemediation();

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  // Keeps the rest of the code working: "Admin" | "Auditor" | "Client"
  const role = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  const allowedTabs = ROLE_TABS[user.role] || ["dashboard"];
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showChangePw, setShowChangePw] = useState(false);
  const [controls, setControls] = useState(INITIAL_CONTROLS);
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedControl, setSelectedControl] = useState(null);
  const [evidenceInput, setEvidenceInput] = useState("");
  const [remarksInput, setRemarksInput] = useState("");
  const [selectedEvidenceFile, setSelectedEvidenceFile] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "warning",
      title: "Finding Created",
      msg: "A.6.3 marked Non-Compliant. Client notified via email.",
      date: "2026-08-22",
    },
    {
      id: 2,
      type: "alert",
      title: "Remediation Overdue",
      msg: "A.8.8 Patching deadline was 2026-09-01.",
      date: "2026-09-02",
    },
  ]);

  // Dynamic calculations excluding N/A controls
  const metrics = useMemo(() => {
    const applicable = controls.filter((c) => c.status !== "N/A");
    const compliant = controls.filter((c) => c.status === "C").length;
    const pc = controls.filter((c) => c.status === "PC").length;
    const nc = controls.filter((c) => c.status === "NC").length;
    const na = controls.filter((c) => c.status === "N/A").length;

    const score =
      applicable.length > 0
        ? Math.round(((compliant + pc * 0.5) / applicable.length) * 100)
        : 0;

    return {
      total: controls.length,
      applicable: applicable.length,
      compliant,
      pc,
      nc,
      na,
      score,
    };
  }, [controls]);

  // Handle Control Evaluation (Auditor action)

  const handleEvaluate = (id, newStatus) => {
    const control = controls.find((c) => c.id === id);

    if (!auditorAudit?.audit?.id || !control?.auditControlId) {
      setEvaluationMessage("Audit or control information is missing.");
      return;
    }

    setFindingDescription("");
    setFindingSeverity("medium");
    setFindingDueDate("");
    setEvaluationMessage("");

    setEvaluationModal({
      control,
      result: newStatus === "N/A" ? "NA" : newStatus,
    });
  };

  const submitEvaluation = async () => {
    if (!evaluationModal) return;

    const { control, result } = evaluationModal;

    if (
      (result === "PC" || result === "NC") &&
      findingDescription.trim().length < 10
    ) {
      setEvaluationMessage(
        "Finding description must be at least 10 characters.",
      );
      return;
    }

    if ((result === "PC" || result === "NC") && !findingDueDate) {
      setEvaluationMessage("Please select a remediation due date.");
      return;
    }

    setEvaluationSaving(true);
    setEvaluationMessage("");

    try {
      await request(
        `/auditor/audits/${auditorAudit.audit.id}/controls/${control.auditControlId}/evaluate`,
        {
          method: "PATCH",
          body: {
            result,
            auditor_comment: "",
            finding_description: findingDescription.trim(),
            severity: findingSeverity,
            due_date: findingDueDate,
          },
        },
      );

      const data = await request(`/auditor/audits/${auditorAudit.audit.id}`);

      setAuditorAudit(data);

      setControls(
        data.controls.map((item) => ({
          id: item.control_id,
          auditControlId: item.audit_control_id,
          category: item.theme,
          title: item.title,
          status: item.result === "NA" ? "N/A" : item.result || "Pending",
          evidence: item.client_explanation || "",
          remarks: item.auditor_comment || "",
          remediation: null,
          workflowStatus: item.workflow_status,
        })),
      );

      setEvaluationModal(null);
      setEvaluationMessage("Evaluation saved successfully!");
    } catch (error) {
      setEvaluationMessage(error.message || "Could not save the evaluation.");
    } finally {
      setEvaluationSaving(false);
    }
  };

  // Handle Evidence Upload (Client action)

  const handleClientSubmit = async (e) => {
    e.preventDefault();

    if (!selectedControl || !clientAudit?.audit?.id) return;

    const explanation = remarksInput.trim();

    if (explanation.length < 10) {
      alert("Please provide an explanation of at least 10 characters.");
      return;
    }

    if (!selectedEvidenceFile) {
      alert("Please select an evidence file.");
      return;
    }

    const formData = new FormData();
    formData.append("client_explanation", explanation);
    formData.append("evidence", selectedEvidenceFile);

    try {
      await request(
        `/client/audits/${clientAudit.audit.id}/controls/${selectedControl.auditControlId}/submit`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await request(`/client/audits/${clientAudit.audit.id}`);

      setClientAudit(data);

      setControls(
        data.controls.map((control) => ({
          id: control.control_id,
          auditControlId: control.audit_control_id,
          category: control.theme,
          title: control.title,
          status: control.result === "NA" ? "N/A" : control.result || "Pending",
          evidence: control.client_explanation || "",
          evidenceFileName: control.evidence_file_name || "",
          evidenceFilePath: control.evidence_file_path || "",
          remarks: control.client_explanation || "",
          remediation: null,
          workflowStatus: control.workflow_status,
        })),
      );

      setSelectedControl(null);
      setSelectedEvidenceFile(null);
      setEvidenceInput("");
      setRemarksInput("");

      alert("Assessment and evidence submitted successfully!");
    } catch (error) {
      alert(error.message || "Could not submit assessment.");
    }
  };

  // Submit corrective action for a finding
  const handleRemediationSubmit = async (finding) => {
    const response = (remediationResponses[finding.finding_id] || "").trim();
    const evidenceFile = remediationFiles[finding.finding_id];

    if (!evidenceFile) {
      setRemediationMessage("Please attach additional evidence.");
      return;
    }

    if (response.length < 10) {
      setRemediationMessage("Please enter at least 10 characters.");
      return;
    }

    setRemediationSavingId(finding.finding_id);
    setRemediationMessage("");

    try {
      const formData = new FormData();

      formData.append("client_response", response);
      formData.append("evidence", evidenceFile);

      const result = await request(
        `/client/audits/${finding.audit_id}/findings/${finding.finding_id}/remediation`,
        {
          method: "POST",
          body: formData,
        },
      );

      setRemediationMessage(result.message);

      setRemediationResponses((previous) => ({
        ...previous,
        [finding.finding_id]: "",
      }));
      setRemediationFiles((previous) => ({
        ...previous,
        [finding.finding_id]: null,
      }));
      const updatedFindings = await request(
        "/client/audits/remediation/findings",
      );

      setRemediationFindings(updatedFindings);
    } catch (error) {
      setRemediationMessage(error.message);
    } finally {
      setRemediationSavingId(null);
    }
  };

  const handleVerifyRemediation = async (finding, verified) => {
    const feedback = (remediationFeedback[finding.finding_id] || "").trim();

    if (!feedback) {
      setRemediationMessage("Please enter auditor feedback.");
      return;
    }

    setRemediationSavingId(finding.finding_id);
    setRemediationMessage("");

    try {
      const result = await request(
        `/auditor/audits/${finding.audit_id}/findings/${finding.finding_id}/verify`,
        {
          method: "PATCH",
          body: {
            verified,
            auditor_feedback: feedback,
          },
        },
      );

      setRemediationMessage(result.message);

      const updatedFindings = await request(
        "/auditor/audits/remediation/findings",
      );

      setRemediationFindings(updatedFindings);
    } catch (error) {
      setRemediationMessage(error.message);
    } finally {
      setRemediationSavingId(null);
    }
  };
  // Run AI Readiness Analysis
  const runAiAnalysis = () => {
    setIsGeneratingAi(true);
    setTimeout(() => {
      const pcCount = metrics.pc;
      const ncCount = metrics.nc;
      setAiReport({
        readinessScore: metrics.score,
        riskLevel:
          metrics.score > 85 ? "LOW" : metrics.score > 60 ? "MEDIUM" : "HIGH",
        gapSummary: `Detected ${ncCount} Non-Compliant findings and ${pcCount} Partially Compliant controls requiring remediation prior to formal certification audit.`,
        recommendations: [
          "Priority 1: Immediately resolve A.8.8 (Management of technical vulnerabilities) - core database exposure detected.",
          "Priority 2: Roll out enterprise security awareness training module to satisfy A.6.3.",
          "Priority 3: Automate SIEM integration for threat intelligence feeds under A.5.7.",
        ],
        certificationEstimate: metrics.score > 85 ? "1-2 Weeks" : "4-6 Weeks",
      });
      setIsGeneratingAi(false);
    }, 1200);
  };

  const filteredControls =
    filterCategory === "All"
      ? controls
      : controls.filter((c) => c.category === filterCategory);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* HEADER & ROLE SWITCHER */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              ISO/IEC 27001:2022 Audit Engine
            </h1>
            <p className="text-xs text-slate-400">
              Presidential Graduate School • AI Audit Platform
            </p>
          </div>
        </div>

        {/* Logged-in user */}
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-white">{user.name}</p>
            <p className="text-[10px] text-indigo-400">{role}</p>
          </div>
          <button
            onClick={() => setShowChangePw(true)}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Password</span>
          </button>
          <button
            onClick={logout}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out</span>
          </button>
        </div>
      </header>

      {/* NAVIGATION TABS */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 flex space-x-6 overflow-x-auto text-sm font-medium">
        {[
          {
            id: "dashboard",
            label: "Dashboard & AI Analysis",
            icon: BarChart3,
          },
          {
            id: "controls",
            label: "Annex A Controls Evaluation",
            icon: ShieldCheck,
          },
          {
            id: "remediation",
            label: "Remediation & Shared Calendar",
            icon: CalendarIcon,
          },
          { id: "notifications", label: "Email & Event Logs", icon: Mail },
          { id: "audits", label: "Audit Management", icon: FileText },
          { id: "users", label: "User Management", icon: UserCheck },
          { id: "report", label: "Final Certification Report", icon: FileText },
        ]
          .filter((tab) => allowedTabs.includes(tab.id))
          .map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-3.5 border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-indigo-500 text-indigo-400 font-semibold"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
      </div>

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* DASHBOARD & AI ANALYSIS TAB */}
        {activeTab === "users" && role === "Admin" && <UsersPage />}

        {activeTab === "audits" && role === "Admin" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Audit Management
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Manage existing audits and add additional Annex A controls.
              </p>
            </div>

            {adminAuditsLoading && (
              <p className="text-sm text-indigo-400">Loading audits...</p>
            )}

            {adminAuditsError && (
              <p className="text-sm text-rose-400">{adminAuditsError}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {adminAudits.map((audit) => (
                <button
                  key={audit.id}
                  onClick={() => setSelectedAdminAudit(audit)}
                  className={`text-left rounded-xl border p-5 transition ${
                    selectedAdminAudit?.id === audit.id
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-slate-700 bg-slate-800/60 hover:border-indigo-400"
                  }`}
                >
                  <h3 className="font-bold text-white">{audit.title}</h3>
                  <p className="text-sm text-slate-400 mt-2">
                    {audit.client_organization}
                  </p>
                  <div className="flex justify-between mt-4 text-xs text-slate-400">
                    <span>Status: {audit.status}</span>
                    <span>Controls: {audit.total_controls}</span>
                  </div>
                </button>
              ))}
            </div>

            {selectedAdminAudit && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Add Controls</h3>
                  <p className="text-sm text-slate-400">
                    Selected audit: {selectedAdminAudit.title}
                  </p>
                </div>

                {controlsMessage && (
                  <p className="text-sm text-indigo-300">{controlsMessage}</p>
                )}

                {availableControls.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No additional controls available for this audit.
                  </p>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {availableControls.map((control) => (
                      <label
                        key={control.id}
                        className="flex items-start gap-3 rounded-lg bg-slate-900 p-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedControlIds.includes(control.id)}
                          onChange={(e) => {
                            setSelectedControlIds((previous) =>
                              e.target.checked
                                ? [...previous, control.id]
                                : previous.filter((id) => id !== control.id),
                            );
                          }}
                          className="mt-1 accent-indigo-500"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-white">
                            {control.control_id} — {control.title}
                          </span>
                          <span className="text-xs text-slate-400">
                            {control.theme}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleAddControls}
                  disabled={addingControls || selectedControlIds.length === 0}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  {addingControls
                    ? "Adding..."
                    : `Add Selected Controls (${selectedControlIds.length})`}
                </button>
              </div>
            )}
          </div>
        )}

        {showChangePw && (
          <ChangePasswordModal onClose={() => setShowChangePw(false)} />
        )}

        {activeTab === "dashboard" && role === "Admin" && (
          <div className="space-y-6">
            {adminLoading && (
              <p className="text-sm text-indigo-400">
                Loading dashboard data...
              </p>
            )}

            {adminError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-400">
                {adminError}
              </div>
            )}

            {adminStats && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Organisations",
                      value: adminStats.organisations?.total ?? 0,
                      color: "text-indigo-400",
                    },
                    {
                      label: "Total Users",
                      value: adminStats.users?.total ?? 0,
                      color: "text-blue-400",
                    },
                    {
                      label: "Total Audits",
                      value: adminStats.audits?.total ?? 0,
                      color: "text-amber-400",
                    },
                    {
                      label: "Total Findings",
                      value: adminStats.findings?.total ?? 0,
                      color: "text-rose-400",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5"
                    >
                      <p className="text-xs font-medium text-slate-400">
                        {item.label}
                      </p>
                      <h3 className={`text-3xl font-bold mt-2 ${item.color}`}>
                        {item.value}
                      </h3>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
                  <h2 className="text-base font-bold text-white mb-4">
                    Audit Status Overview
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      ["Draft", adminStats.audits?.draft],
                      ["In Progress", adminStats.audits?.in_progress],
                      ["Completed", adminStats.audits?.completed],
                      ["Closed", adminStats.audits?.closed],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-slate-900 rounded-xl p-4">
                        <p className="text-xs text-slate-400">{label}</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {value ?? 0}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
                  <h2 className="text-base font-bold text-white mb-4">
                    Annex A Control Overview
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      ["Compliant", adminStats.controls?.compliant],
                      [
                        "Partially Compliant",
                        adminStats.controls?.partially_compliant,
                      ],
                      ["Non-Compliant", adminStats.controls?.non_compliant],
                      ["Not Applicable", adminStats.controls?.not_applicable],
                      ["Pending", adminStats.controls?.pending],
                      ["Awaiting Review", adminStats.controls?.awaiting_review],
                      ["Remediation", adminStats.controls?.remediation],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-slate-900 rounded-xl p-4">
                        <p className="text-xs text-slate-400">{label}</p>
                        <p className="text-xl font-bold text-white mt-1">
                          {value ?? 0}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
                    <h2 className="text-sm font-bold text-white mb-3">
                      Compliance Rate
                    </h2>
                    <p className="text-4xl font-bold text-emerald-400">
                      {Number(adminStats.compliance_rate ?? 0).toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      Based on assessed audit controls
                    </p>
                  </div>

                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
                    <h2 className="text-sm font-bold text-white mb-3">
                      Findings Overview
                    </h2>
                    <div className="space-y-2 text-sm text-slate-300">
                      <p>Open: {adminStats.findings?.open ?? 0}</p>
                      <p>
                        Awaiting Verification:{" "}
                        {adminStats.findings?.awaiting_verification ?? 0}
                      </p>
                      <p>Resolved: {adminStats.findings?.resolved ?? 0}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "dashboard" && role === "Client" && (
          <div className="space-y-6">
            {clientLoading && (
              <p className="text-sm text-indigo-400">
                Loading your audit data...
              </p>
            )}

            {clientError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-400">
                {clientError}
              </div>
            )}

            {clientStats && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    ["Assigned Audits", clientStats.audits?.total],
                    ["In Progress", clientStats.audits?.in_progress],
                    ["Completed", clientStats.audits?.completed],
                    ["Total Controls", clientStats.controls?.total],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5"
                    >
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="text-3xl font-bold text-indigo-400 mt-2">
                        {value ?? 0}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
                  <h2 className="text-base font-bold text-white mb-4">
                    Control Assessment Overview
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      ["Pending", clientStats.controls?.pending],
                      [
                        "Awaiting Review",
                        clientStats.controls?.awaiting_review,
                      ],
                      ["Evaluated", clientStats.controls?.evaluated],
                      ["Remediation", clientStats.controls?.remediation],
                      ["Compliant", clientStats.controls?.compliant],
                      [
                        "Partially Compliant",
                        clientStats.controls?.partially_compliant,
                      ],
                      ["Non-Compliant", clientStats.controls?.non_compliant],
                      ["Not Applicable", clientStats.controls?.not_applicable],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-slate-900 rounded-xl p-4">
                        <p className="text-xs text-slate-400">{label}</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {value ?? 0}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
                  <h2 className="text-base font-bold text-white mb-4">
                    Findings Overview
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      ["Open Findings", clientStats.findings?.open],
                      [
                        "Awaiting Verification",
                        clientStats.findings?.awaiting_verification,
                      ],
                      ["Resolved Findings", clientStats.findings?.resolved],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-slate-900 rounded-xl p-4">
                        <p className="text-xs text-slate-400">{label}</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {value ?? 0}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
                  <h2 className="text-base font-bold text-white mb-4">
                    My Assigned Audits
                  </h2>

                  {clientStats.audit_list?.length > 0 ? (
                    <div className="space-y-3">
                      {clientStats.audit_list.map((audit) => (
                        <div
                          key={audit.id}
                          className="bg-slate-900 rounded-xl p-4 flex flex-wrap justify-between gap-3"
                        >
                          <div>
                            <h3 className="text-sm font-semibold text-white">
                              {audit.title}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                              {audit.scope}
                            </p>
                            <p className="text-xs text-slate-400 mt-2">
                              Controls: {audit.evaluated_controls ?? 0} /{" "}
                              {audit.total_controls ?? 0} evaluated
                            </p>
                          </div>
                          <span className="text-xs text-indigo-400 font-semibold">
                            {audit.status?.replace("_", " ").toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      No audits have been assigned to your organisation yet.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "dashboard" && role === "Auditor" && (
          <div className="space-y-6">
            {auditorLoading && (
              <p className="text-sm text-indigo-400">
                Loading assigned audit data...
              </p>
            )}

            {auditorError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-400">
                {auditorError}
              </div>
            )}

            {auditorStats && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    ["Assigned Audits", auditorStats.audits?.total],
                    ["In Progress", auditorStats.audits?.in_progress],
                    ["Completed", auditorStats.audits?.completed],
                    ["Closed", auditorStats.audits?.closed],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5"
                    >
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="text-3xl font-bold text-indigo-400 mt-2">
                        {value ?? 0}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
                  <h2 className="text-base font-bold text-white mb-4">
                    Assigned Control Overview
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      [
                        "Awaiting Review",
                        auditorStats.controls?.awaiting_review,
                      ],
                      ["Evaluated", auditorStats.controls?.evaluated],
                      ["Pending", auditorStats.controls?.pending],
                      ["Remediation", auditorStats.controls?.remediation],
                      ["Compliant", auditorStats.controls?.compliant],
                      [
                        "Partially Compliant",
                        auditorStats.controls?.partially_compliant,
                      ],
                      ["Non-Compliant", auditorStats.controls?.non_compliant],
                      ["Not Applicable", auditorStats.controls?.not_applicable],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-slate-900 rounded-xl p-4">
                        <p className="text-xs text-slate-400">{label}</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {value ?? 0}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
                  <h2 className="text-base font-bold text-white mb-4">
                    Findings Overview
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      ["Open Findings", auditorStats.findings?.open],
                      [
                        "Awaiting Verification",
                        auditorStats.findings?.awaiting_verification,
                      ],
                      ["Resolved Findings", auditorStats.findings?.resolved],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-slate-900 rounded-xl p-4">
                        <p className="text-xs text-slate-400">{label}</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {value ?? 0}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* CONTROLS EVALUATION TAB */}
        {activeTab === "controls" && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-400 font-medium">
                  Filter Category:
                </span>
                {[
                  "All",
                  "Organizational",
                  "People",
                  "Physical",
                  "Technological",
                ].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      filterCategory === cat
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <span className="text-xs text-slate-400">
                Showing {filteredControls.length} of {controls.length} Annex A
                controls
              </span>
            </div>

            <div className="bg-slate-800/40 rounded-xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-4">Control ID</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Title & Details</th>
                      <th className="p-4">Evidence</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredControls.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-800/50 transition-all"
                      >
                        <td className="p-4 font-mono font-bold text-indigo-400 whitespace-nowrap">
                          {c.id}
                        </td>
                        <td className="p-4 whitespace-nowrap text-slate-400">
                          {c.category}
                        </td>
                        <td className="p-4 max-w-xs">
                          <div className="font-semibold text-white">
                            {c.title}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                            {c.remarks || "No notes attached."}
                          </div>
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          {c.evidenceFileName ? (
                            <div className="flex flex-col gap-2">
                              <span className="inline-flex items-center space-x-1 text-xs text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-2.5 py-1 rounded-md">
                                <FileText className="w-3.5 h-3.5" />
                                <span className="max-w-[150px] truncate">
                                  {c.evidenceFileName}
                                </span>
                              </span>

                              {c.evidenceFilePath && (
                                <a
                                  href={`http://localhost:5000${c.evidenceFilePath}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-sky-400 hover:text-sky-300 underline"
                                >
                                  Open Evidence
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">
                              No evidence uploaded
                            </span>
                          )}
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md font-bold text-[11px] ${
                              c.status === "C"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : c.status === "PC"
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : c.status === "NC"
                                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                    : "bg-slate-700/40 text-slate-400 border border-slate-600/30"
                            }`}
                          >
                            {c.status === "C" && (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            {c.status === "NC" && (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            {c.status === "PC" && (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {c.status === "C"
                                ? "Compliant (C)"
                                : c.status === "PC"
                                  ? "Partially (PC)"
                                  : c.status === "NC"
                                    ? "Non-Compliant (NC)"
                                    : "N/A"}
                            </span>
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-1 whitespace-nowrap">
                          {role === "Auditor" && (
                            <div className="inline-flex bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                              {["C", "PC", "NC", "N/A"].map((st) => (
                                <button
                                  key={st}
                                  onClick={() => handleEvaluate(c.id, st)}
                                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                    c.status === st
                                      ? "bg-indigo-600 text-white"
                                      : "text-slate-400 hover:text-slate-200"
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          )}

                          {role === "Client" && (
                            <button
                              onClick={() => setSelectedControl(c)}
                              className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            >
                              Submit Evidence
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CLIENT EVIDENCE UPLOAD MODAL */}
        {selectedControl && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white">
                  Upload Evidence: {selectedControl.id}
                </h3>
                <button
                  onClick={() => setSelectedControl(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleClientSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Control Title
                  </label>
                  <p className="text-slate-200 font-semibold">
                    {selectedControl.title}
                  </p>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">
                    Upload Evidence File
                  </label>

                  <input
                    type="file"
                    required
                    accept=".pdf,.png,.jpg,.jpeg,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];

                      if (!file) {
                        setSelectedEvidenceFile(null);
                        return;
                      }

                      const allowedExtensions = [
                        "pdf",
                        "png",
                        "jpg",
                        "jpeg",
                        "docx",
                      ];

                      const extension = file.name
                        .split(".")
                        .pop()
                        .toLowerCase();

                      if (!allowedExtensions.includes(extension)) {
                        alert(
                          "Only PDF, PNG, JPG, JPEG, and DOCX files are allowed.",
                        );
                        e.target.value = "";
                        setSelectedEvidenceFile(null);
                        return;
                      }

                      if (file.size > 10 * 1024 * 1024) {
                        alert("File size must not exceed 10 MB.");
                        e.target.value = "";
                        setSelectedEvidenceFile(null);
                        return;
                      }

                      setSelectedEvidenceFile(file);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100 file:mr-3 file:px-3 file:py-1 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:cursor-pointer"
                  />

                  <p className="text-[10px] text-slate-500 mt-2">
                    Accepted formats: PDF, PNG, JPG, JPEG, DOCX. Maximum size:
                    10 MB.
                  </p>

                  {selectedEvidenceFile && (
                    <p className="text-emerald-400 mt-2">
                      Selected: {selectedEvidenceFile.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">
                    Implementation Remarks
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Explain how this control is satisfied in your organization..."
                    value={remarksInput}
                    onChange={(e) => setRemarksInput(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedControl(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30"
                  >
                    Save & Submit Evidence
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {evaluationModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Evaluate Control: {evaluationModal.control.id}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {evaluationModal.control.title}
                  </p>
                </div>

                <button
                  onClick={() => setEvaluationModal(null)}
                  disabled={evaluationSaving}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-2">
                    Evaluation Result
                  </label>

                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                    <span className="text-white font-bold">
                      {evaluationModal.result === "NA"
                        ? "Not Applicable (N/A)"
                        : evaluationModal.result === "C"
                          ? "Compliant (C)"
                          : evaluationModal.result === "PC"
                            ? "Partially Compliant (PC)"
                            : "Non-Compliant (NC)"}
                    </span>
                  </div>
                </div>

                {(evaluationModal.result === "PC" ||
                  evaluationModal.result === "NC") && (
                  <>
                    <div>
                      <label className="block text-slate-400 mb-1">
                        Finding Description
                      </label>
                      <textarea
                        rows={3}
                        value={findingDescription}
                        onChange={(e) => setFindingDescription(e.target.value)}
                        placeholder="Describe the identified control gap..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">
                        Severity
                      </label>
                      <select
                        value={findingSeverity}
                        onChange={(e) => setFindingSeverity(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">
                        Remediation Due Date
                      </label>
                      <input
                        type="date"
                        value={findingDueDate}
                        onChange={(e) => setFindingDueDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </>
                )}

                {evaluationMessage && (
                  <p className="text-rose-400">{evaluationMessage}</p>
                )}

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    disabled={evaluationSaving}
                    onClick={() => setEvaluationModal(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={evaluationSaving}
                    onClick={submitEvaluation}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                  >
                    {evaluationSaving ? "Saving..." : "Confirm Evaluation"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REMEDIATION & CALENDAR TAB */}
        {activeTab === "remediation" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>Tracked Remediation Tasks (PC / NC Findings)</span>
              </h2>

              <div className="space-y-3">
                {role === "Client" ? (
                  <>
                    {remediationLoading && (
                      <p className="text-sm text-slate-400">
                        Loading findings...
                      </p>
                    )}

                    {remediationError && (
                      <p className="text-sm text-rose-400">
                        {remediationError}
                      </p>
                    )}

                    {remediationMessage && (
                      <p className="text-sm text-emerald-400">
                        {remediationMessage}
                      </p>
                    )}

                    {!remediationLoading &&
                      remediationFindings.length === 0 && (
                        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
                          No findings currently require corrective action.
                        </div>
                      )}

                    {remediationFindings.map((finding) => (
                      <div
                        key={finding.finding_id}
                        className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl space-y-3"
                      >
                        <div className="flex flex-wrap justify-between gap-3">
                          <div>
                            <p className="text-xs font-mono text-indigo-400">
                              {finding.control_id} · {finding.audit_title}
                            </p>
                            <h4 className="text-sm font-semibold text-white mt-1">
                              {finding.control_title}
                            </h4>
                            <p className="text-xs text-slate-300 mt-2">
                              {finding.description}
                            </p>
                            <p className="text-xs text-slate-400 mt-2">
                              Due date:{" "}
                              {finding.due_date
                                ? new Date(
                                    finding.due_date,
                                  ).toLocaleDateString()
                                : "Not specified"}
                            </p>
                          </div>

                          <span className="text-xs text-amber-400">
                            {finding.finding_status}
                          </span>
                        </div>

                        {finding.finding_status === "open" && (
                          <>
                            <textarea
                              value={
                                remediationResponses[finding.finding_id] || ""
                              }
                              onChange={(e) =>
                                setRemediationResponses((previous) => ({
                                  ...previous,
                                  [finding.finding_id]: e.target.value,
                                }))
                              }
                              placeholder="Explain the corrective actions taken..."
                              rows={3}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white"
                            />
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.docx"
                              onChange={(e) =>
                                setRemediationFiles((previous) => ({
                                  ...previous,
                                  [finding.finding_id]:
                                    e.target.files?.[0] || null,
                                }))
                              }
                            />

                            <button
                              onClick={() => handleRemediationSubmit(finding)}
                              disabled={
                                remediationSavingId === finding.finding_id
                              }
                              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg disabled:opacity-50"
                            >
                              {remediationSavingId === finding.finding_id
                                ? "Submitting..."
                                : "Submit Corrective Action"}
                            </button>
                          </>
                        )}

                        {finding.finding_status === "remediation_submitted" && (
                          <p className="text-xs text-indigo-300">
                            Corrective action submitted. Waiting for auditor
                            verification.
                          </p>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {remediationLoading && (
                      <p className="text-sm text-slate-400">
                        Loading findings...
                      </p>
                    )}

                    {remediationError && (
                      <p className="text-sm text-rose-400">
                        {remediationError}
                      </p>
                    )}

                    {remediationMessage && (
                      <p className="text-sm text-emerald-400">
                        {remediationMessage}
                      </p>
                    )}

                    {!remediationLoading &&
                      remediationFindings.length === 0 && (
                        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
                          No corrective actions are waiting for verification.
                        </div>
                      )}

                    {remediationFindings.map((finding) => (
                      <div
                        key={finding.finding_id}
                        className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl space-y-3"
                      >
                        <div>
                          <p className="text-xs font-mono text-indigo-400">
                            {finding.control_id} · {finding.audit_title}
                          </p>
                          <h4 className="text-sm font-semibold text-white mt-1">
                            {finding.control_title}
                          </h4>
                          <p className="text-xs text-slate-300 mt-2">
                            Finding: {finding.description}
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            Client submission (Round {finding.round_no}):
                          </p>
                          <p className="text-sm text-white bg-slate-900 p-3 rounded-lg mt-1">
                            {finding.client_response}
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            Due date:{" "}
                            {finding.due_date
                              ? new Date(finding.due_date).toLocaleDateString()
                              : "Not specified"}
                          </p>
                        </div>

                        <textarea
                          value={remediationFeedback[finding.finding_id] || ""}
                          onChange={(e) =>
                            setRemediationFeedback((previous) => ({
                              ...previous,
                              [finding.finding_id]: e.target.value,
                            }))
                          }
                          placeholder="Enter your verification feedback..."
                          rows={3}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white"
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() =>
                              handleVerifyRemediation(finding, true)
                            }
                            disabled={
                              remediationSavingId === finding.finding_id
                            }
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg disabled:opacity-50"
                          >
                            Accept Corrective Action
                          </button>

                          <button
                            onClick={() =>
                              handleVerifyRemediation(finding, false)
                            }
                            disabled={
                              remediationSavingId === finding.finding_id
                            }
                            className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-4 py-2 rounded-lg disabled:opacity-50"
                          >
                            Reject & Request Resubmission
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <CalendarIcon className="w-4 h-4 text-indigo-400" />
                <span>Shared Audit Calendar</span>
              </h3>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center">
                <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">
                  September 2026
                </p>
                <div className="grid grid-cols-7 gap-2 mt-4 text-[11px] text-slate-400 font-mono">
                  <span>Su</span>
                  <span>Mo</span>
                  <span>Tu</span>
                  <span>We</span>
                  <span>Th</span>
                  <span>Fr</span>
                  <span>Sa</span>
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
                    const isDeadline = day === 10 || day === 15;
                    return (
                      <div
                        key={day}
                        className={`py-1.5 rounded-md font-bold text-center ${
                          isDeadline
                            ? "bg-rose-500/20 border border-rose-500 text-rose-400"
                            : "hover:bg-slate-800 text-slate-300"
                        }`}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-slate-300">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                  <span>Sep 10: Remediation Deadline (A.6.3)</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-300">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                  <span>Sep 15: Remediation Deadline (A.5.7)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === "notifications" && (
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              <span>Automated Email & Audit Event Notifications</span>
            </h2>

            <div className="space-y-3">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-start space-x-3"
                >
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      n.type === "warning"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-rose-500/20 text-rose-400"
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-white">
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-slate-500">
                        {n.date}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{n.msg}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FINAL CERTIFICATION REPORT TAB */}
        {activeTab === "report" && (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 space-y-6 max-w-4xl mx-auto">
            <div className="border-b border-slate-800 pb-6 flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                  ISO/IEC 27001:2022 Audit Report
                </span>
                <h2 className="text-2xl font-bold text-white mt-1">
                  Formal Audit & Readiness Evaluation
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Prepared by Authorized Auditor • Client: Presidential Graduate
                  School
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  metrics.score >= 80
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}
              >
                {metrics.score >= 80
                  ? "RECOMMENDED FOR CERTIFICATION"
                  : "REMEDIATION REQUIRED"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-400">
                  Total Controls Evaluated:
                </span>
                <p className="text-lg font-bold text-white mt-1">
                  {metrics.total} ({metrics.applicable} Applicable)
                </p>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-400">
                  Final Compliance Readiness:
                </span>
                <p className="text-lg font-bold text-indigo-400 mt-1">
                  {metrics.score}%
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                Audit Findings Breakdown
              </h3>
              <div className="space-y-2 text-xs">
                {controls.map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center bg-slate-900/60 p-3 rounded-lg border border-slate-800/80"
                  >
                    <div>
                      <span className="font-mono font-bold text-indigo-400">
                        {c.id}
                      </span>
                      <span className="text-slate-200 ml-2">{c.title}</span>
                    </div>
                    <span
                      className={`font-bold text-[11px] ${
                        c.status === "C"
                          ? "text-emerald-400"
                          : c.status === "PC"
                            ? "text-amber-400"
                            : c.status === "NC"
                              ? "text-rose-400"
                              : "text-slate-400"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800 flex justify-between items-center">
              <div className="text-xs text-slate-400">
                <p>
                  Lead Auditor:{" "}
                  <span className="text-slate-200 font-medium">
                    Ms. Jasana Kayastha
                  </span>
                </p>
                <p>
                  Date:{" "}
                  <span className="text-slate-200 font-medium">
                    August 23, 2026
                  </span>
                </p>
              </div>

              {role === "Admin" || role === "Auditor" ? (
                <button
                  onClick={() =>
                    alert("Audit formally closed and report generated.")
                  }
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all"
                >
                  Formal Audit Closure & Sign-Off
                </button>
              ) : (
                <span className="text-xs text-slate-500 italic">
                  Sign-off restricted to Lead Auditor/Admin
                </span>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
