import React from 'react';
import { 
  LayoutDashboard, 
  Activity, 
  ShieldCheck, 
  FileText, 
  Cpu, 
  ChevronLeft, 
  ChevronRight,
  Sliders,
  Layers,
  Database
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  sidebarExpanded,
  setSidebarExpanded,
}) {
  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      subtitle: 'System & Resources',
      icon: LayoutDashboard,
    },
    {
      id: 'analyze',
      label: 'Analyze',
      subtitle: 'Live Sensor Pipeline',
      icon: Activity,
    },
    {
      id: 'risk',
      label: 'Risk Certificates',
      subtitle: 'Q-SCOPE Bounds',
      icon: ShieldCheck,
    },
    {
      id: 'runs',
      label: 'Runs & Audit',
      subtitle: 'Workloads & Logs',
      icon: FileText,
    },
    {
      id: 'health',
      label: 'Health Monitor',
      subtitle: '4Q VQC & CUSUM',
      icon: Cpu,
    },
  ];

  return (
    <aside
      className={`fixed top-12 left-0 bottom-0 bg-qpure border-r border-qborder z-40 transition-all duration-150 ease-in-out select-none flex flex-col justify-between ${
        sidebarExpanded ? 'w-56' : 'w-12'
      }`}
    >
      {/* Top Nav Items */}
      <div className="py-2 flex flex-col space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`h-11 w-full flex items-center transition-colors relative text-left ${
                isActive
                  ? 'bg-qarctic text-qnavy font-semibold carbon-row-selected'
                  : 'text-qslate hover:text-qnavy hover:bg-qarctic/60'
              }`}
              title={!sidebarExpanded ? item.label : undefined}
            >
              {/* Left Accent indicator when active */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-qblue" />
              )}

              {/* Icon */}
              <div className="w-12 h-11 flex items-center justify-center flex-shrink-0">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-qblue' : 'text-qslate'
                  }`}
                />
              </div>

              {/* Label (when expanded) */}
              {sidebarExpanded && (
                <div className="overflow-hidden pr-3">
                  <div className={`text-xs truncate ${isActive ? 'text-qnavy font-semibold' : 'text-qslate'}`}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-qslate-light truncate">
                    {item.subtitle}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Footer / Collapse Toggle */}
      <div className="p-2 border-t border-qborder bg-qarctic/30">
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="w-full h-8 flex items-center justify-center text-qslate hover:text-qnavy hover:bg-qpure border border-transparent hover:border-qborder transition-colors text-xs font-mono"
          title={sidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {sidebarExpanded ? (
            <div className="flex items-center space-x-2">
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="text-[11px]">Collapse View</span>
            </div>
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </aside>
  );
}
