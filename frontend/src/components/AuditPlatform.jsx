import React, { useState, useMemo } from "react";
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
  Printer,
} from "lucide-react";

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

export default function AuditPlatform() {
  const [role, setRole] = useState("Auditor"); // 'Auditor' | 'Client' | 'Admin'
  const [activeTab, setActiveTab] = useState("dashboard");
  const [controls, setControls] = useState(INITIAL_CONTROLS);
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedControl, setSelectedControl] = useState(null);
  const [evidenceInput, setEvidenceInput] = useState("");
  const [remarksInput, setRemarksInput] = useState("");
  const [aiReport, setAiReport] = useState(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Report Generation & Metadata State
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportOrg, setReportOrg] = useState("Presidential Graduate School");
  const [reportScope, setReportScope] = useState(
    "Enterprise IT Infrastructure, Cloud Operations & Academic Data Systems",
  );
  const [leadAuditor, setLeadAuditor] = useState("Ms. Jasana Kayastha");

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
    setControls((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          let updatedRemediation = c.remediation;
          if ((newStatus === "PC" || newStatus === "NC") && !c.remediation) {
            updatedRemediation = {
              task: `Remediate control gap for ${c.id}: ${c.title}`,
              deadline: "2026-09-30",
              status: "Pending Evidence",
            };
            setNotifications((n) => [
              {
                id: Date.now(),
                type: "warning",
                title: `Finding Triggered: ${c.id}`,
                msg: `Automated email notification sent to Client organization. Severity: ${newStatus}`,
                date: new Date().toISOString().split("T")[0],
              },
              ...n,
            ]);
          }
          return { ...c, status: newStatus, remediation: updatedRemediation };
        }
        return c;
      }),
    );
  };

  // Handle Evidence Upload (Client action)
  const handleClientSubmit = (e) => {
    e.preventDefault();
    if (!selectedControl) return;

    setControls((prev) =>
      prev.map((c) => {
        if (c.id === selectedControl.id) {
          return {
            ...c,
            evidence: evidenceInput || c.evidence,
            remarks: remarksInput || c.remarks,
            remediation: c.remediation
              ? { ...c.remediation, status: "Under Auditor Re-evaluation" }
              : null,
          };
        }
        return c;
      }),
    );

    setSelectedControl(null);
    setEvidenceInput("");
    setRemarksInput("");
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

        {/* Role Selector */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 px-3 font-medium">Role:</span>
          {["Auditor", "Client", "Admin"].map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                role === r
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {r}
            </button>
          ))}
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
          { id: "report", label: "Final Certification Report", icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-3.5 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
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
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Readiness Score
                  </p>
                  <h3 className="text-2xl font-bold text-indigo-400 mt-1">
                    {metrics.score}%
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Excluding N/A controls
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 flex items-center justify-center font-bold text-xs text-indigo-400">
                  {metrics.score}%
                </div>
              </div>

              <div className="bg-slate-800/60 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-xs font-medium text-emerald-400">
                  Compliant (C)
                </p>
                <h3 className="text-2xl font-bold text-white mt-1">
                  {metrics.compliant}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  {Math.round(
                    (metrics.compliant / metrics.applicable) * 100 || 0,
                  )}
                  % of applicable controls
                </p>
              </div>

              <div className="bg-slate-800/60 border border-amber-500/20 rounded-xl p-4">
                <p className="text-xs font-medium text-amber-400">
                  Partially Compliant (PC)
                </p>
                <h3 className="text-2xl font-bold text-white mt-1">
                  {metrics.pc}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Remediation required
                </p>
              </div>

              <div className="bg-slate-800/60 border border-rose-500/20 rounded-xl p-4">
                <p className="text-xs font-medium text-rose-400">
                  Non-Compliant (NC)
                </p>
                <h3 className="text-2xl font-bold text-white mt-1">
                  {metrics.nc}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Critical gap / Audit finding
                </p>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-400">
                  Not Applicable (N/A)
                </p>
                <h3 className="text-2xl font-bold text-white mt-1">
                  {metrics.na}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Out of audit scope
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/90 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-wrap justify-between items-center gap-4 border-b border-indigo-500/20 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-400/30">
                    <Cpu className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      AI Readiness & Gap Analysis Engine
                    </h2>
                    <p className="text-xs text-slate-400">
                      Automated evaluation based on real-time Annex A control
                      state
                    </p>
                  </div>
                </div>

                <button
                  onClick={runAiAnalysis}
                  disabled={isGeneratingAi}
                  className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isGeneratingAi ? "animate-spin" : ""}`}
                  />
                  <span>
                    {isGeneratingAi
                      ? "Analyzing Annex A Controls..."
                      : "Run AI Analysis"}
                  </span>
                </button>
              </div>

              {aiReport ? (
                <div className="mt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                      <p className="text-xs text-slate-400">
                        AI Readiness Rating
                      </p>
                      <p className="text-xl font-bold text-indigo-400 mt-1">
                        {aiReport.readinessScore}% Ready
                      </p>
                    </div>
                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                      <p className="text-xs text-slate-400">
                        Calculated Risk Exposure
                      </p>
                      <span
                        className={`inline-block mt-1 px-2.5 py-0.5 rounded-md text-xs font-bold ${
                          aiReport.riskLevel === "LOW"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/20 text-rose-400"
                        }`}
                      >
                        {aiReport.riskLevel} RISK
                      </span>
                    </div>
                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                      <p className="text-xs text-slate-400">
                        Est. Time to Certification
                      </p>
                      <p className="text-xl font-bold text-slate-200 mt-1">
                        {aiReport.certificationEstimate}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 p-4 rounded-xl border border-indigo-500/20">
                    <h4 className="text-xs font-semibold uppercase text-indigo-400 tracking-wider">
                      Gap Executive Summary
                    </h4>
                    <p className="text-sm text-slate-300 mt-2">
                      {aiReport.gapSummary}
                    </p>
                  </div>

                  <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                    <h4 className="text-xs font-semibold uppercase text-indigo-400 tracking-wider mb-3">
                      Prioritized Remediation Recommendations
                    </h4>
                    <ul className="space-y-2">
                      {aiReport.recommendations.map((rec, idx) => (
                        <li
                          key={idx}
                          className="flex items-start space-x-2 text-xs text-slate-300"
                        >
                          <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="mt-8 text-center py-8">
                  <Cpu className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">
                    Click "Run AI Analysis" to synthesize current findings and
                    generate gap analysis.
                  </p>
                </div>
              )}
            </div>
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
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
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
                          {c.evidence ? (
                            <span className="inline-flex items-center space-x-1 text-xs text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-2.5 py-1 rounded-md">
                              <FileText className="w-3.5 h-3.5" />
                              <span className="max-w-[100px] truncate">
                                {c.evidence}
                              </span>
                            </span>
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
                                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
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
                              className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
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
                  className="text-slate-400 hover:text-white cursor-pointer"
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
                    Evidence File Name / Artifact Link
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., SOC2_Type2_Report.pdf or AWS_Config.json"
                    value={evidenceInput}
                    onChange={(e) => setEvidenceInput(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
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
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 cursor-pointer"
                  >
                    Save & Submit Evidence
                  </button>
                </div>
              </form>
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
                {controls.filter((c) => c.remediation).length === 0 ? (
                  <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
                    No active remediation tasks. All applicable controls are
                    compliant!
                  </div>
                ) : (
                  controls
                    .filter((c) => c.remediation)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl flex flex-wrap justify-between items-center gap-4"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-indigo-400">
                              {c.id}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                c.status === "NC"
                                  ? "bg-rose-500/20 text-rose-400"
                                  : "bg-amber-500/20 text-amber-400"
                              }`}
                            >
                              {c.status} Finding
                            </span>
                          </div>
                          <h4 className="text-xs font-semibold text-white mt-1">
                            {c.remediation.task}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Deadline: {c.remediation.deadline}
                          </p>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-slate-400 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg">
                            {c.remediation.status}
                          </span>
                          {role === "Auditor" && (
                            <button
                              onClick={() => handleEvaluate(c.id, "C")}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
                            >
                              Mark Resolved
                            </button>
                          )}
                        </div>
                      </div>
                    ))
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
          <div className="max-w-4xl mx-auto space-y-4">
            {!reportGenerated ? (
              /* Initial State: Show Generate Button */
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-10 text-center space-y-6 shadow-xl">
                <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30 flex items-center justify-center mx-auto shadow-inner">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">
                    ISO/IEC 27001:2022 Certification Audit Report
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Click the button below to compile live Annex A control
                    statuses, readiness metrics, and non-conformity findings
                    into a formal print-ready certification report.
                  </p>
                </div>
                <button
                  onClick={() => setReportGenerated(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer inline-flex items-center space-x-2"
                >
                  <Cpu className="w-4 h-4" />
                  <span>Generate Report</span>
                </button>
              </div>
            ) : (
              /* Generated State: Show Full Report & Action Bar */
              <div className="space-y-4">
                {/* Top Action Bar (Hidden when printing) */}
                <div className="flex justify-between items-center bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl print:hidden">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Formal ISO/IEC 27001:2022 Audit Report
                    </h3>
                    <p className="text-xs text-slate-400">
                      Compiled successfully from live evaluation metrics
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setReportGenerated(false)}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      Reset / Reconfigure
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print / Save as PDF</span>
                    </button>
                  </div>
                </div>

                {/* Printable Formal Document Container */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 md:p-10 space-y-8 shadow-2xl print:bg-white print:text-black print:border-none print:shadow-none">
                  {/* Document Header */}
                  <div className="border-b-2 border-indigo-500/40 pb-6 flex flex-wrap justify-between items-start gap-4 print:border-slate-300">
                    <div>
                      <div className="flex items-center space-x-2 text-indigo-400 print:text-indigo-700">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-widest">
                          Confidential • ISO/IEC 27001:2022 Certification Audit
                        </span>
                      </div>
                      <h2 className="text-2xl font-bold text-white mt-2 print:text-slate-900">
                        Information Security Management System (ISMS) Audit
                        Report
                      </h2>
                      <p className="text-xs text-slate-400 mt-1 print:text-slate-600">
                        Document ID:{" "}
                        <span className="font-mono">ISMS-AUD-2026-089</span> •
                        Standard:{" "}
                        <span className="font-semibold">
                          ISO/IEC 27001:2022
                        </span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide ${
                          metrics.score >= 80
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 print:bg-emerald-100 print:text-emerald-800"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30 print:bg-rose-100 print:text-rose-800"
                        }`}
                      >
                        {metrics.score >= 80
                          ? "RECOMMENDED FOR CERTIFICATION"
                          : "CORRECTIVE ACTION REQUIRED"}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-2 print:text-slate-500">
                        Classification: Restricted
                      </p>
                    </div>
                  </div>

                  {/* 1. Audit Metadata & Scope Table (Editable Inputs) */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 print:text-indigo-700">
                      1. Organization & Audit Engagement Details (Editable)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-800 border border-slate-800 rounded-xl overflow-hidden text-xs print:bg-slate-300 print:border-slate-300">
                      <div className="bg-slate-950/90 p-3.5 print:bg-slate-50">
                        <span className="text-slate-400 block text-[11px] print:text-slate-500 mb-1">
                          Client Organization
                        </span>
                        <input
                          type="text"
                          value={reportOrg}
                          onChange={(e) => setReportOrg(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-semibold print:bg-transparent print:border-none print:text-slate-900 print:p-0"
                        />
                      </div>
                      <div className="bg-slate-950/90 p-3.5 print:bg-slate-50">
                        <span className="text-slate-400 block text-[11px] print:text-slate-500 mb-1">
                          Audit Type & Stage
                        </span>
                        <span className="font-semibold text-white print:text-slate-900 block py-1">
                          Stage 2 Certification Readiness Audit
                        </span>
                      </div>
                      <div className="bg-slate-950/90 p-3.5 print:bg-slate-50">
                        <span className="text-slate-400 block text-[11px] print:text-slate-500 mb-1">
                          ISMS Scope Statement
                        </span>
                        <input
                          type="text"
                          value={reportScope}
                          onChange={(e) => setReportScope(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-semibold print:bg-transparent print:border-none print:text-slate-900 print:p-0"
                        />
                      </div>
                      <div className="bg-slate-950/90 p-3.5 print:bg-slate-50">
                        <span className="text-slate-400 block text-[11px] print:text-slate-500 mb-1">
                          Statement of Applicability (SoA)
                        </span>
                        <span className="font-semibold text-white print:text-slate-900 block py-1">
                          v2.4 ({metrics.applicable} Applicable Controls /{" "}
                          {metrics.na} Excluded)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Executive Compliance Summary */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 print:text-indigo-700">
                      2. Executive Summary & Readiness Metrics
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 print:bg-slate-50 print:text-slate-700 print:border-slate-200">
                      An independent conformity assessment was conducted against
                      the requirements of <strong>ISO/IEC 27001:2022</strong>{" "}
                      for <strong>{reportOrg}</strong>. Out of{" "}
                      <strong>
                        {metrics.applicable} applicable Annex A controls
                      </strong>{" "}
                      evaluated, the organization achieved an overall readiness
                      score of <strong>{metrics.score}%</strong>.
                      {metrics.nc > 0
                        ? ` Currently, ${metrics.nc} Non-Conformity (NC) and ${metrics.pc} Partially Compliant (PC) findings require documented root-cause analysis and corrective evidence prior to final certificate issuance.`
                        : ` All evaluated controls meet conformity requirements with zero open non-conformities.`}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 print:bg-white print:border-slate-300">
                        <span className="text-slate-400 text-[11px]">
                          Overall Readiness
                        </span>
                        <p className="text-xl font-bold text-indigo-400 mt-0.5 print:text-indigo-700">
                          {metrics.score}%
                        </p>
                      </div>
                      <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 print:bg-white print:border-slate-300">
                        <span className="text-slate-400 text-[11px]">
                          Compliant (C)
                        </span>
                        <p className="text-xl font-bold text-emerald-400 mt-0.5 print:text-emerald-700">
                          {metrics.compliant}
                        </p>
                      </div>
                      <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 print:bg-white print:border-slate-300">
                        <span className="text-slate-400 text-[11px]">
                          Partial (PC)
                        </span>
                        <p className="text-xl font-bold text-amber-400 mt-0.5 print:text-amber-700">
                          {metrics.pc}
                        </p>
                      </div>
                      <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 print:bg-white print:border-slate-300">
                        <span className="text-slate-400 text-[11px]">
                          Non-Compliant (NC)
                        </span>
                        <p className="text-xl font-bold text-rose-400 mt-0.5 print:text-rose-700">
                          {metrics.nc}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 3. Annex A Detailed Conformity Matrix */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 print:text-indigo-700">
                      3. Annex A Control Conformity Matrix & Evidence Log
                    </h3>
                    <div className="border border-slate-800 rounded-xl overflow-hidden print:border-slate-300">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                          <tr>
                            <th className="p-3 font-semibold">Control</th>
                            <th className="p-3 font-semibold">
                              Domain & Requirement
                            </th>
                            <th className="p-3 font-semibold">
                              Verified Evidence
                            </th>
                            <th className="p-3 font-semibold text-right">
                              Finding
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 print:divide-slate-200">
                          {controls.map((c) => (
                            <tr
                              key={c.id}
                              className="bg-slate-900/40 print:bg-white"
                            >
                              <td className="p-3 font-mono font-bold text-indigo-400 whitespace-nowrap print:text-indigo-700">
                                {c.id}
                              </td>
                              <td className="p-3">
                                <div className="font-semibold text-slate-200 print:text-slate-900">
                                  {c.title}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5 print:text-slate-600">
                                  {c.remarks ||
                                    "Verified during audit walkthrough."}
                                </div>
                              </td>
                              <td className="p-3 font-mono text-[11px] text-slate-300 print:text-slate-700">
                                {c.evidence || (
                                  <span className="italic text-slate-500">
                                    None provided
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                    c.status === "C"
                                      ? "bg-emerald-500/20 text-emerald-400 print:bg-emerald-100 print:text-emerald-800"
                                      : c.status === "PC"
                                        ? "bg-amber-500/20 text-amber-400 print:bg-amber-100 print:text-amber-800"
                                        : c.status === "NC"
                                          ? "bg-rose-500/20 text-rose-400 print:bg-rose-100 print:text-rose-800"
                                          : "bg-slate-800 text-slate-400 print:bg-slate-100 print:text-slate-600"
                                  }`}
                                >
                                  {c.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 4. Non-Conformity & Corrective Action Plan (CAP) */}
                  {controls.filter(
                    (c) => c.status === "NC" || c.status === "PC",
                  ).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 print:text-rose-700">
                        4. Non-Conformity & Corrective Action Plan (CAP)
                      </h3>
                      <div className="space-y-2 text-xs">
                        {controls
                          .filter((c) => c.status === "NC" || c.status === "PC")
                          .map((c) => (
                            <div
                              key={c.id}
                              className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl flex justify-between items-start gap-4 print:bg-slate-50 print:border-slate-300"
                            >
                              <div>
                                <span className="font-mono font-bold text-indigo-400 print:text-indigo-700">
                                  {c.id} ({c.status})
                                </span>
                                <p className="text-slate-200 font-medium mt-0.5 print:text-slate-900">
                                  {c.remediation?.task ||
                                    `Address gap in ${c.title}`}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[11px] text-slate-400 block">
                                  Target Closure
                                </span>
                                <span className="font-mono font-semibold text-rose-400 print:text-rose-700">
                                  {c.remediation?.deadline || "2026-09-30"}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* 5. Formal Attestation & Sign-Off */}
                  <div className="pt-6 border-t border-slate-800 space-y-6 print:border-slate-300">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 print:text-indigo-700">
                      5. Lead Auditor Attestation & Formal Sign-Off (Editable)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                      <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2 print:bg-slate-50 print:border-slate-300">
                        <p className="text-slate-400 text-[11px]">
                          Lead ISO/IEC 27001 Auditor
                        </p>
                        <input
                          type="text"
                          value={leadAuditor}
                          onChange={(e) => setLeadAuditor(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold text-sm print:bg-transparent print:border-none print:text-slate-900 print:p-0"
                        />
                        <p className="text-slate-400 text-[11px]">
                          Credential: IRCA Certified ISMS Lead Auditor
                        </p>
                        <div className="pt-3 border-t border-slate-800/80 flex justify-between text-[11px] text-slate-500 print:border-slate-300">
                          <span>
                            Signature: /s/ {leadAuditor.split(" ").pop()}
                          </span>
                          <span>Date: 2026-11-12</span>
                        </div>
                      </div>

                      <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2 print:bg-slate-50 print:border-slate-300">
                        <p className="text-slate-400 text-[11px]">
                          Client Management Representative
                        </p>
                        <p className="font-bold text-white text-sm print:text-slate-900">
                          Information Security Officer
                        </p>
                        <p className="text-slate-400 text-[11px]">
                          Organization: {reportOrg}
                        </p>
                        <div className="pt-3 border-t border-slate-800/80 flex justify-between text-[11px] text-slate-500 print:border-slate-300">
                          <span>Status: Acknowledged</span>
                          <span>Date: 2026-11-12</span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Closure Button (Hidden on Print) */}
                    <div className="flex justify-end print:hidden">
                      {role === "Admin" || role === "Auditor" ? (
                        <button
                          onClick={() =>
                            alert(
                              "ISO/IEC 27001:2022 Audit Report formally signed off and locked.",
                            )
                          }
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                        >
                          Formal Audit Closure & Sign-Off
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 italic">
                          Sign-off restricted to Lead Auditor / Admin roles
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
