import React, { useState } from 'react';
import { 
  Menu, 
  X, 
  RotateCcw, 
  HelpCircle, 
  ChevronDown, 
  Activity, 
  SlidersHorizontal,
  ExternalLink,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { SENSOR_PRODUCTS } from '../services/products';

export default function Header({
  activeTab,
  sidebarExpanded,
  setSidebarExpanded,
  activeProduct,
  setActiveProduct,
  setShowProductModal,
  health,
  quantumStatus,
  onResetQuantum,
  isResetting,
}) {
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const getBreadcrumbTitle = (tab) => {
    switch (tab) {
      case 'overview': return 'System Overview';
      case 'analyze': return 'Real-time Analysis Pipeline';
      case 'risk': return 'Q-SCOPE Risk Certificates';
      case 'runs': return 'Workloads, Runs & Audit';
      case 'health': return 'Quantum Health Monitor';
      default: return 'Overview';
    }
  };

  return (
    <header className="h-12 bg-qpure border-b border-qborder flex items-center justify-between px-3 fixed top-0 left-0 right-0 z-50 select-none">
      {/* Left: Rail Toggle & Brand Lockup */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="h-9 w-9 flex items-center justify-center text-qnavy hover:bg-qarctic border border-transparent hover:border-qborder transition-colors"
          title={sidebarExpanded ? "Collapse navigation" : "Expand navigation"}
          aria-label="Toggle navigation"
        >
          {sidebarExpanded ? <X className="w-4 h-4 text-qslate" /> : <Menu className="w-4 h-4 text-qnavy" />}
        </button>

        {/* Brand Lockup */}
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-qnavy flex items-center justify-center text-white font-mono text-[11px] font-bold tracking-wider">
            Q
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="font-bold text-[14px] text-qnavy tracking-tight font-mono">
              QSCOPE
            </span>
            <span className="hidden sm:inline-block text-[11px] text-qslate font-normal border-l border-qborder pl-2">
              Quantum Sensor Observation & Prognostics
            </span>
          </div>
        </div>

        {/* Breadcrumb trail */}
        <div className="hidden md:flex items-center space-x-1.5 text-xs text-qslate pl-2 border-l border-qborder">
          <span className="text-qslate-light">Platform</span>
          <span className="text-qslate-light">/</span>
          <span className="font-mono text-qnavy font-medium">{activeProduct.code}</span>
          <span className="text-qslate-light">/</span>
          <span className="text-qnavy font-medium">{getBreadcrumbTitle(activeTab)}</span>
        </div>
      </div>

      {/* Right: Global Actions & Product Switcher */}
      <div className="flex items-center space-x-2">
        {/* Active Product & Sensor Selector Pill */}
        <div className="relative">
          <button
            onClick={() => setShowProductDropdown(!showProductDropdown)}
            className="flex items-center space-x-2 h-8 px-2.5 bg-qarctic border border-qborder hover:border-qblue text-qnavy text-xs transition-colors"
            title="Switch Target Hardware & Measurement Profile"
          >
            <span className="w-2 h-2 rounded-full bg-qblue"></span>
            <span className="font-mono font-medium">{activeProduct.code}</span>
            <span className="hidden xl:inline text-qslate text-[11px]">({activeProduct.sensorFamily})</span>
            <ChevronDown className="w-3.5 h-3.5 text-qslate" />
          </button>

          {/* Quick Dropdown Menu */}
          {showProductDropdown && (
            <div className="absolute right-0 mt-1 w-80 bg-qpure border border-qborder shadow-carbon-md z-50 text-xs py-1">
              <div className="px-3 py-2 border-b border-qborder bg-qarctic flex items-center justify-between">
                <span className="font-semibold text-qnavy uppercase tracking-wider text-[10px]">
                  Select Hardware Target
                </span>
                <button
                  onClick={() => {
                    setShowProductDropdown(false);
                    setShowProductModal(true);
                  }}
                  className="text-[10px] text-qblue hover:underline font-mono"
                >
                  Full Catalog
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {SENSOR_PRODUCTS.map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => {
                      setActiveProduct(prod);
                      setShowProductDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 flex items-start space-x-2 hover:bg-qarctic transition-colors ${
                      activeProduct.id === prod.id ? 'bg-qblue-subtle/50 border-l-2 border-qblue' : ''
                    }`}
                  >
                    <div className="mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${
                        activeProduct.id === prod.id ? 'bg-qblue' : 'bg-qslate-light'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-qnavy">{prod.code}</span>
                        <span className="text-[10px] text-qteal font-mono">C = {prod.physics.baselineContrast}</span>
                      </div>
                      <div className="text-[11px] text-qslate truncate">{prod.sensorName}</div>
                      <div className="text-[10px] text-qslate-light mt-0.5">N = {prod.physics.atomCountDefault} atoms · {prod.physics.primaryMetricName}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-2 border-t border-qborder bg-qarctic">
                <button
                  onClick={() => {
                    setShowProductDropdown(false);
                    setShowProductModal(true);
                  }}
                  className="w-full h-7 bg-qblue text-white text-xs font-medium hover:bg-qblue-hover flex items-center justify-center space-x-1"
                >
                  <span>Open Hardware Configuration</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Engine Status Tag */}
        <div className="hidden lg:flex items-center space-x-2 h-8 px-2 bg-qgreen-subtle border border-qgreen-border text-qgreen-text text-[11px] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-qgreen animate-pulse"></span>
          <span>4Q Statevector Online</span>
        </div>

        {/* Quantum Accumulator Reset Utility */}
        <button
          onClick={onResetQuantum}
          disabled={isResetting}
          className="h-8 px-2.5 flex items-center space-x-1.5 bg-qpure hover:bg-qarctic border border-qborder text-qnavy text-xs transition-colors disabled:opacity-50"
          title="Reset Quantum Accumulator and clear latched CUSUM alarms"
        >
          <RotateCcw className={`w-3.5 h-3.5 text-qslate ${isResetting ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline font-mono text-[11px]">Reset Core</span>
        </button>

        {/* Operator Profile */}
        <div className="hidden sm:flex items-center space-x-1.5 h-8 px-2 bg-qarctic border border-qborder text-qnavy text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-qslate"></span>
          <span className="text-[11px]">Lab Operator</span>
        </div>
      </div>
    </header>
  );
}
