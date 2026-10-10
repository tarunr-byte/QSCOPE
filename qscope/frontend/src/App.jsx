import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ProductOnboardingModal from './components/ProductOnboardingModal';
import OverviewView from './components/OverviewView';
import AnalyzeView from './components/AnalyzeView';
import RiskCertificatesView from './components/RiskCertificatesView';
import RunsAuditView from './components/RunsAuditView';
import HealthMonitorView from './components/HealthMonitorView';
import { SENSOR_PRODUCTS } from './services/products';
import { fetchHealth, fetchQuantumStatus, resetQuantum, analyzeWindow } from './services/api';

export default function App() {
  // Navigation & Shell State
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  // Target Hardware Product & Sensor State
  const [activeProduct, setActiveProduct] = useState(SENSOR_PRODUCTS[0]);
  const [showProductModal, setShowProductModal] = useState(false);

  // Live System Telemetry State
  const [health, setHealth] = useState(null);
  const [quantumStatus, setQuantumStatus] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);

  // Polling backend status
  const loadSystemStatus = async () => {
    try {
      const [h, q] = await Promise.all([
        fetchHealth().catch(() => null),
        fetchQuantumStatus().catch(() => null),
      ]);
      if (h) setHealth(h);
      if (q) setQuantumStatus(q);
    } catch (err) {
      console.warn('Backend polling error:', err);
    }
  };

  useEffect(() => {
    loadSystemStatus();
    const interval = setInterval(loadSystemStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  // Reset quantum engine accumulator
  const handleResetQuantum = async () => {
    setIsResetting(true);
    try {
      await resetQuantum();
      await loadSystemStatus();
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Run full pipeline window analysis
  const handleAnalyzeWindow = async (windowToAnalyze) => {
    try {
      const res = await analyzeWindow(windowToAnalyze);
      setAnalysisResult(res);
      await loadSystemStatus();
      return res;
    } catch (err) {
      console.error('Analyze failed:', err);
      setErrorBanner(`Analysis failed: ${err.message}`);
      throw err;
    }
  };

  return (
    <div className="min-h-screen bg-qarctic text-qnavy font-sans antialiased flex flex-col selection:bg-qblue-subtle selection:text-qblue">
      {/* Carbon 48px Header */}
      <Header
        activeTab={activeTab}
        sidebarExpanded={sidebarExpanded}
        setSidebarExpanded={setSidebarExpanded}
        activeProduct={activeProduct}
        setActiveProduct={setActiveProduct}
        setShowProductModal={setShowProductModal}
        health={health}
        quantumStatus={quantumStatus}
        onResetQuantum={handleResetQuantum}
        isResetting={isResetting}
      />

      {/* Main Content Layout with Responsive Margin for Side Nav */}
      <div className="flex-1 flex pt-12">
        {/* Carbon Side Navigation Rail / Drawer */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sidebarExpanded={sidebarExpanded}
          setSidebarExpanded={setSidebarExpanded}
        />

        {/* Dynamic Workspace Container */}
        <main
          className={`flex-1 transition-all duration-150 ease-in-out px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full ${
            sidebarExpanded ? 'md:ml-56 ml-12' : 'ml-12'
          }`}
        >
          {errorBanner && (
            <div className="mb-6 p-3 bg-qred-subtle border border-qred-border text-qred-text text-xs font-mono flex items-center justify-between">
              <span>{errorBanner}</span>
              <button
                onClick={() => setErrorBanner(null)}
                className="font-bold hover:underline px-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* 1. Overview */}
          {activeTab === 'overview' && (
            <OverviewView
              activeProduct={activeProduct}
              quantumStatus={quantumStatus}
              analysisResult={analysisResult}
              onNavigate={(tab) => setActiveTab(tab)}
              onResetQuantum={handleResetQuantum}
              isResetting={isResetting}
            />
          )}

          {/* 2. Analyze (3-Stage Live Pipeline + Telemetry Scrubber) */}
          {activeTab === 'analyze' && (
            <AnalyzeView
              activeProduct={activeProduct}
              quantumStatus={quantumStatus}
              onRefreshStatus={loadSystemStatus}
              onAnalyzeWindow={handleAnalyzeWindow}
              analysisResult={analysisResult}
            />
          )}

          {/* 3. Risk Certificates (Q-SCOPE Boundary Evaluation) */}
          {activeTab === 'risk' && (
            <RiskCertificatesView
              activeProduct={activeProduct}
              analysisResult={analysisResult}
              onAnalyzeCurrent={() => handleAnalyzeWindow(activeProduct.generateWindow(0))}
            />
          )}

          {/* 4. Runs & Audit (Carbon DataTable & SQLite Audit Log) */}
          {activeTab === 'runs' && (
            <RunsAuditView activeProduct={activeProduct} />
          )}

          {/* 5. Health Monitor (4-Qubit Statevector VQC & Calibration) */}
          {activeTab === 'health' && (
            <HealthMonitorView
              activeProduct={activeProduct}
              quantumStatus={quantumStatus}
              analysisResult={analysisResult}
              onRefreshStatus={loadSystemStatus}
            />
          )}
        </main>
      </div>

      {/* Carbon Footer */}
      <footer className={`border-t border-qborder bg-qpure py-3 transition-all duration-150 ${
        sidebarExpanded ? 'md:ml-56 ml-12' : 'ml-12'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-qslate gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-qnavy">QSCOPE v2.1.0</span>
            <span>·</span>
            <span>Quantum Sensor Condition Observation & Prognostics Engine</span>
          </div>
          <div className="flex items-center space-x-3 text-qslate-light">
            <span>FastAPI @ 127.0.0.1:8000</span>
            <span>·</span>
            <span>React 18 + Vite @ 3000</span>
            <span>·</span>
            <span>Quantum Precision White</span>
          </div>
        </div>
      </footer>

      {/* Target Hardware Configuration Modal */}
      <ProductOnboardingModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        activeProduct={activeProduct}
        onSelectProduct={(p) => setActiveProduct(p)}
      />
    </div>
  );
}
