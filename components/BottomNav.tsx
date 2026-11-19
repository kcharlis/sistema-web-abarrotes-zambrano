import React from 'react';
import { Home, Package, Users, BarChart3, Lock } from 'lucide-react';
import { Tab, UserRole } from '../types';

interface BottomNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  userRole?: UserRole;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, userRole = 'admin' }) => {
  const getButtonClass = (isActive: boolean) => 
    `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`;

  return (
    <nav className="absolute bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center z-20 rounded-b-[28px] sm:rounded-b-[28px]">
      <button 
        onClick={() => setActiveTab('home')}
        className={getButtonClass(activeTab === 'home')}
      >
        <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
        <span className="text-[10px] font-bold">Inicio</span>
      </button>
      <button 
        onClick={() => setActiveTab('inventory')}
        className={getButtonClass(activeTab === 'inventory')}
      >
        <Package size={24} strokeWidth={activeTab === 'inventory' ? 2.5 : 2} />
        <span className="text-[10px] font-bold">Inventario</span>
      </button>
      <button 
        onClick={() => setActiveTab('debtors')}
        className={getButtonClass(activeTab === 'debtors')}
      >
        <Users size={24} strokeWidth={activeTab === 'debtors' ? 2.5 : 2} />
        <span className="text-[10px] font-bold">Fiados</span>
      </button>
      <button 
        onClick={() => setActiveTab('reports')}
        className={getButtonClass(activeTab === 'reports')}
      >
        <div className="relative">
          <BarChart3 size={24} strokeWidth={activeTab === 'reports' ? 2.5 : 2} />
          {userRole === 'dependiente' && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 shadow-sm">
              <Lock size={9} strokeWidth={3} />
            </span>
          )}
        </div>
        <span className="text-[10px] font-bold">Reportes</span>
      </button>
    </nav>
  );
};

export default BottomNav;
