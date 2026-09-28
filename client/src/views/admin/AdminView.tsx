import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { CameraCapture } from '../../components/CameraCapture';
import { ImageUploadCompressor } from '../../components/ImageUploadCompressor';
import { DetailedReportsDashboard } from '../../components/DetailedReportsDashboard';
import { resolveImageUrl } from '../../utils/imageUrl';
import { Users, DollarSign, FileText, CheckCircle, XCircle, AlertCircle, Building2, Plus, Edit2, Trash2, Settings, Shield, Utensils, BarChart3, FolderPlus, Tag, Clock, Sparkles, Globe, Key, Lock, ShieldCheck, ShieldAlert, UserCheck, UserX } from 'lucide-react';
import { CreateCategoryModal } from '../../components/CreateCategoryModal';
import { TIMEZONE_OPTIONS, getDeviceTimezone } from '../../utils/timezone';
import { gToast } from '../../utils/toast';
import { tactileFeedback } from '../../utils/feedback';

export const AdminView: React.FC = () => {
  const { 
    currentBranchId, branches, refreshBranches, settings, refreshSettings, 
    t, language, setTimezoneMode, setSelectedTimezone, activeTimezone, formatTime 
  } = useApp();
  const [activeTab, setActiveTab] = useState<'employees' | 'branches' | 'tables' | 'settings' | 'expenses' | 'audit' | 'menu' | 'analytics' | 'accountRequests'>('employees');
  const [users, setUsers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Menu Management State
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingMenuItemId, setEditingMenuItemId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState('');
  const [menuNameAmharic, setMenuNameAmharic] = useState('');
  const [menuPrice, setMenuPrice] = useState<number>(100);
  const [menuCategory, setMenuCategory] = useState('');
  const [menuRouting, setMenuRouting] = useState<'KITCHEN' | 'BAR' | 'BOTH' | 'BAKERY' | 'FRONT_COUNTER'>('KITCHEN');
  const [menuDesc, setMenuDesc] = useState('');
  const [menuPhoto, setMenuPhoto] = useState<string>('');

  // Table & Section Management State
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [tableName, setTableName] = useState('');
  const [tableSection, setTableSection] = useState('Main Dining');
  const [customSection, setCustomSection] = useState('');
  const [tableCapacity, setTableCapacity] = useState<number>(4);
  const [tableBranch, setTableBranch] = useState(currentBranchId);

  // Staff Creation Form State
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('password123');
  const [staffRole, setStaffRole] = useState<'waiter' | 'cashier' | 'chef' | 'barista' | 'storekeeper' | 'admin'>('waiter');
  const [staffBranch, setStaffBranch] = useState(currentBranchId);
  const [staffPhone, setStaffPhone] = useState('');
  const [staffEmpId, setStaffEmpId] = useState('');

  // Branch CRUD State
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchCity, setBranchCity] = useState('Addis Ababa');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchVatRate, setBranchVatRate] = useState<number>(0.15);

  // App Name & Branding Settings State
  const [appName, setAppName] = useState(settings?.restaurant_name || 'Yo Burger & Restaurant');
  const [appSlogan, setAppSlogan] = useState(settings?.slogan || 'Delicious Burgers & Seamless Hospitality');
  const [appLogo, setAppLogo] = useState<string | null>(settings?.logo_url || '/logo.png');
  const [primaryColor, setPrimaryColor] = useState(settings?.primary_color || '#ff9e01');
  const [secondaryColor, setSecondaryColor] = useState(settings?.secondary_color || '#940500');
  const [adminTzMode, setAdminTzMode] = useState<'AUTO' | 'MANUAL'>(settings?.timezone_mode || 'AUTO');
  const [adminSysTz, setAdminSysTz] = useState<string>(settings?.system_timezone || 'Africa/Addis_Ababa');

  useEffect(() => {
    if (settings) {
      if (settings.restaurant_name) setAppName(settings.restaurant_name);
      if (settings.slogan) setAppSlogan(settings.slogan);
      if (settings.logo_url) setAppLogo(settings.logo_url);
      if (settings.primary_color) setPrimaryColor(settings.primary_color);
      if (settings.secondary_color) setSecondaryColor(settings.secondary_color);
      if (settings.timezone_mode) setAdminTzMode(settings.timezone_mode);
      if (settings.system_timezone) setAdminSysTz(settings.system_timezone);
    }
  }, [settings]);

  // Account & Password Requests (Admin Strict Approval)
  const [accountRequests, setAccountRequests] = useState<any[]>([]);
  const [accountRequestsFilter, setAccountRequestsFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [selectedReqForApproval, setSelectedReqForApproval] = useState<any | null>(null);
  const [selectedReqForRejection, setSelectedReqForRejection] = useState<any | null>(null);
  const [adminPassOverride, setAdminPassOverride] = useState('');
  const [adminReviewNote, setAdminReviewNote] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Direct Staff Password Reset Modal
  const [directResetTarget, setDirectResetTarget] = useState<any | null>(null);
  const [directResetPassword, setDirectResetPassword] = useState('');
  const [isDirectResetting, setIsDirectResetting] = useState(false);

  // Expense form
  const [expenseCategory, setExpenseCategory] = useState('Electricity');
  const [expenseAmount, setExpenseAmount] = useState<number>(500);
  const [expenseDescription, setExpenseDescription] = useState('');

  const loadData = () => {
    api.request<any[]>('/admin/users').then(setUsers).catch(() => {});
    api.request<any[]>(`/expenses?branchId=${currentBranchId}`).then(setExpenses).catch(() => {});
    api.request<any[]>(`/admin/audit-logs?branchId=${currentBranchId}`).then(setAuditLogs).catch(() => {});
    api.request<any[]>(`/tables?branchId=${currentBranchId}`).then(setTables).catch(() => {});
    api.request<any[]>('/menu/items?all=true').then(setMenuItems).catch(() => {});
    api.request<any[]>('/menu/categories').then(setCategories).catch(() => {});
    api.request<any[]>('/auth/admin/account-requests').then(setAccountRequests).catch(() => {});
    refreshBranches();
  };

  // Table CRUD Handlers
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const finalSection = tableSection === 'CUSTOM' ? customSection.trim() : tableSection;
    try {
      if (editingTableId) {
        await api.request(`/tables/${editingTableId}`, {
          method: 'PUT',
          body: JSON.stringify({
            table_number: tableNumber,
            name: tableName || tableNumber,
            section: finalSection || 'Main Dining',
            capacity: Number(tableCapacity)
          })
        });
        gToast.success('Table updated successfully!');
      } else {
        await api.request('/tables', {
          method: 'POST',
          body: JSON.stringify({
            branch_id: tableBranch === 'ALL' ? branches[0]?.id : tableBranch,
            table_number: tableNumber,
            name: tableName || tableNumber,
            section: finalSection || 'Main Dining',
            capacity: Number(tableCapacity)
          })
        });
        gToast.success('Table and Section created successfully!');
      }
      setShowTableModal(false);
      setEditingTableId(null);
      setTableNumber('');
      setTableName('');
      setCustomSection('');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to save table');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTable = async (tblId: string, tblNum: string) => {
    if (!window.confirm(`Are you sure you want to remove Table ${tblNum}?`)) return;
    try {
      await api.request(`/tables/${tblId}`, { method: 'DELETE' });
      gToast.success('Table removed successfully');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to delete table');
    }
  };

  // Menu CRUD Handlers
  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const catId = menuCategory || (categories[0]?.id || 'cat_burgers');
    setLoading(true);
    try {
      if (editingMenuItemId) {
        await api.request(`/menu/items/${editingMenuItemId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: menuName,
            name_amharic: menuNameAmharic || null,
            category_id: catId,
            price: Number(menuPrice),
            routing_destination: menuRouting,
            description: menuDesc,
            photo_url: menuPhoto.trim() || null
          })
        });
        gToast.success('Menu item updated successfully!');
      } else {
        await api.request('/menu/items', {
          method: 'POST',
          body: JSON.stringify({
            name: menuName,
            name_amharic: menuNameAmharic || null,
            category_id: catId,
            price: Number(menuPrice),
            routing_destination: menuRouting,
            description: menuDesc,
            photo_url: menuPhoto.trim() || null
          })
        });
        gToast.success('Menu item created successfully!');
      }
      setShowMenuModal(false);
      setEditingMenuItemId(null);
      setMenuName('');
      setMenuNameAmharic('');
      setMenuPrice(100);
      setMenuDesc('');
      setMenuPhoto('');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to save menu item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMenuItem = async (itemId: string, itemName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${itemName}"?`)) return;
    try {
      await api.request(`/menu/items/${itemId}`, { method: 'DELETE' });
      gToast.success('Menu item deleted successfully');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to delete menu item');
    }
  };

  const openEditMenuItem = (item: any) => {
    setEditingMenuItemId(item.id);
    setMenuName(item.name);
    setMenuNameAmharic(item.name_amharic || '');
    setMenuPrice(item.price);
    setMenuCategory(item.category_id);
    setMenuRouting(item.routing_destination || 'KITCHEN');
    setMenuDesc(item.description || '');
    setMenuPhoto(item.photo_url || '');
    setShowMenuModal(true);
  };

  const openEditTable = (t: any) => {
    setEditingTableId(t.id);
    setTableNumber(t.table_number);
    setTableName(t.name);
    setTableSection(t.section);
    setTableCapacity(t.capacity);
    setTableBranch(t.branch_id);
    setShowTableModal(true);
  };

  useEffect(() => {
    loadData();
    const unsub = api.onEvent((event) => {
      if (
        event?.type === 'USER_ACCOUNT_REQUEST_NEW' ||
        event?.type === 'USER_ACCOUNT_REQUEST_RESOLVED' ||
        event?.type === 'USER_ACCOUNT_REQUEST_UPDATED'
      ) {
        api.request<any[]>('/auth/admin/account-requests').then(setAccountRequests).catch(() => {});
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, [currentBranchId]);

  useEffect(() => {
    if (settings) {
      setAppName(settings.restaurant_name);
      setAppSlogan(settings.slogan || '');
      setAppLogo(settings.logo_url || null);
      setPrimaryColor(settings.primary_color || '#ff9e01');
      setSecondaryColor(settings.secondary_color || '#940500');
    }
  }, [settings]);

  // 1. Create Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.request('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          full_name: staffName,
          username: staffUsername,
          password: staffPassword,
          role: staffRole,
          branch_id: staffBranch,
          phone: staffPhone,
          employee_id: staffEmpId
        })
      });
      setShowStaffModal(false);
      setStaffName('');
      setStaffUsername('');
      loadData();
      gToast.success('Staff member created and activated successfully!');
    } catch (err: any) {
      gToast.error(err.message || 'Failed to create staff member');
    } finally {
      setLoading(false);
    }
  };

  // 2. Create or Edit Branch
  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingBranchId) {
        // Edit Branch
        await api.request(`/branches/${editingBranchId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: branchName,
            city: branchCity,
            address: branchAddress,
            phone: branchPhone,
            vat_rate: Number(branchVatRate)
          })
        });
        gToast.success('Branch updated successfully!');
      } else {
        // Create Branch
        await api.request('/branches', {
          method: 'POST',
          body: JSON.stringify({
            name: branchName,
            city: branchCity,
            address: branchAddress,
            phone: branchPhone,
            vat_rate: Number(branchVatRate)
          })
        });
        gToast.success('Branch created successfully!');
      }
      setShowBranchModal(false);
      setEditingBranchId(null);
      setBranchName('');
      setBranchAddress('');
      setBranchPhone('');
      refreshBranches();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to save branch');
    } finally {
      setLoading(false);
    }
  };

  // Delete Branch
  const handleDeleteBranch = async (branchId: string, bName: string) => {
    if (!window.confirm(`Are you sure you want to deactivate and remove ${bName}?`)) return;
    try {
      await api.request(`/branches/${branchId}`, { method: 'DELETE' });
      gToast.success('Branch deleted successfully');
      refreshBranches();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to delete branch');
    }
  };

  const openEditBranch = (b: any) => {
    setEditingBranchId(b.id);
    setBranchName(b.name);
    setBranchCity(b.city);
    setBranchAddress(b.address || '');
    setBranchPhone(b.phone || '');
    setBranchVatRate(b.vat_rate || 0.15);
    setShowBranchModal(true);
  };

  // 3. Save Branding / App Name, Logo & Timezone
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const tzMatch = TIMEZONE_OPTIONS.find(o => o.value === adminSysTz);
    const offsetMin = tzMatch ? tzMatch.offsetMinutes : 180;
    try {
      await api.request('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          restaurant_name: appName,
          slogan: appSlogan,
          logo_url: appLogo,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          timezone_mode: adminTzMode,
          system_timezone: adminSysTz,
          timezone_offset_minutes: offsetMin
        })
      });
      // Synchronize client context
      if (adminTzMode === 'MANUAL') {
        setSelectedTimezone(adminSysTz, offsetMin);
        setTimezoneMode('manual');
      } else {
        setTimezoneMode('auto');
      }
      refreshSettings();
      gToast.success('Restaurant Branding & Timezone settings updated successfully!');
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update branding settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUserStatus = async (userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED') => {
    try {
      await api.request(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update user');
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.request('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: currentBranchId,
          category: expenseCategory,
          amount: Number(expenseAmount),
          description: expenseDescription
        })
      });
      setExpenseDescription('');
      loadData();
      gToast.success('Expense recorded successfully');
    } catch (err: any) {
      gToast.error(err.message || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  // Account Request Management Handlers (Admin Strict Approval)
  const handleApproveRequest = async () => {
    if (!selectedReqForApproval) return;
    setIsProcessingAction(true);
    tactileFeedback('click');
    try {
      const res = await api.request<any>(`/auth/admin/account-requests/${selectedReqForApproval.id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({
          admin_notes: adminReviewNote.trim() || undefined,
          admin_password_override: adminPassOverride.trim() || undefined
        })
      });
      tactileFeedback('success');
      gToast.success(res.message || 'ጥያቄው ጸድቋል! የተጠቃሚው መረጃ/የይለፍ ቃል ተቀይሯል።');
      setSelectedReqForApproval(null);
      setAdminPassOverride('');
      setAdminReviewNote('');
      loadData();
    } catch (err: any) {
      tactileFeedback('error');
      gToast.error(err.message || 'ጥያቄውን ማጽደቅ አልተቻለም');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedReqForRejection) return;
    setIsProcessingAction(true);
    tactileFeedback('click');
    try {
      const res = await api.request<any>(`/auth/admin/account-requests/${selectedReqForRejection.id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({
          admin_notes: adminReviewNote.trim() || 'በአስተዳዳሪው ውድቅ ተደርጓል (Rejected by admin)'
        })
      });
      tactileFeedback('success');
      gToast.success(res.message || 'ጥያቄው ውድቅ ተደርጓል');
      setSelectedReqForRejection(null);
      setAdminReviewNote('');
      loadData();
    } catch (err: any) {
      tactileFeedback('error');
      gToast.error(err.message || 'ውድቅ ማድረግ አልተቻለም');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleDirectPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directResetTarget || !directResetPassword || directResetPassword.trim().length < 6) {
      gToast.error('የይለፍ ቃል ቢያንስ 6 ፊደላት መሆን አለበት (Password min 6 chars)');
      return;
    }
    setIsDirectResetting(true);
    tactileFeedback('click');
    try {
      const res = await api.request<any>('/auth/admin/direct-reset-password', {
        method: 'POST',
        body: JSON.stringify({
          user_id: directResetTarget.id,
          new_password: directResetPassword.trim()
        })
      });
      tactileFeedback('success');
      gToast.success(res.message || `የ @${directResetTarget.username} የይለፍ ቃል ተቀይሯል!`);
      setDirectResetTarget(null);
      setDirectResetPassword('');
      loadData();
    } catch (err: any) {
      tactileFeedback('error');
      gToast.error(err.message || 'የይለፍ ቃል መቀየር አልተቻለም');
    } finally {
      setIsDirectResetting(false);
    }
  };

  const pendingUsers = users.filter(u => u.status === 'PENDING_APPROVAL');
  const pendingAccountRequests = accountRequests.filter(r => r.status === 'PENDING');

  return (
    <div className="view-body animate-fade-in">
      {/* Tab Navigation */}
      <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 10, padding: 4, marginBottom: 16, overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('employees')}
          style={{ flex: 1, minWidth: 70, padding: '8px 4px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: activeTab === 'employees' ? '#ffffff' : 'transparent', color: activeTab === 'employees' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Staff ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('accountRequests')}
          style={{
            flex: 1,
            minWidth: 95,
            padding: '8px 4px',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 8,
            background: activeTab === 'accountRequests' ? '#ffffff' : 'transparent',
            color: activeTab === 'accountRequests' ? 'var(--primary)' : pendingAccountRequests.length > 0 ? '#b45309' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4
          }}
        >
          <Lock size={12} />
          {language === 'am' ? 'ጥያቄዎች' : 'Approvals'}
          {pendingAccountRequests.length > 0 && (
            <span
              style={{
                background: '#ef4444',
                color: '#ffffff',
                fontSize: 10,
                fontWeight: 900,
                padding: '1px 5px',
                borderRadius: 10,
                lineHeight: 1
              }}
            >
              {pendingAccountRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('branches')}
          style={{ flex: 1, minWidth: 75, padding: '8px 4px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: activeTab === 'branches' ? '#ffffff' : 'transparent', color: activeTab === 'branches' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Branches ({branches.length})
        </button>
        <button
          onClick={() => setActiveTab('tables')}
          style={{ flex: 1, minWidth: 70, padding: '8px 4px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: activeTab === 'tables' ? '#ffffff' : 'transparent', color: activeTab === 'tables' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Tables ({tables.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          style={{ flex: 1, minWidth: 70, padding: '8px 4px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: activeTab === 'settings' ? '#ffffff' : 'transparent', color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Branding
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          style={{ flex: 1, minWidth: 70, padding: '8px 4px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: activeTab === 'expenses' ? '#ffffff' : 'transparent', color: activeTab === 'expenses' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Expenses
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          style={{ flex: 1, minWidth: 70, padding: '8px 4px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: activeTab === 'audit' ? '#ffffff' : 'transparent', color: activeTab === 'audit' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Audit
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          style={{ flex: 1, minWidth: 70, padding: '8px 4px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: activeTab === 'menu' ? '#ffffff' : 'transparent', color: activeTab === 'menu' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Menu ({menuItems.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          style={{ flex: 1, minWidth: 70, padding: '8px 4px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: activeTab === 'analytics' ? '#ffffff' : 'transparent', color: activeTab === 'analytics' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          {language === 'am' ? 'ሪፖርቶች' : 'Analytics'}
        </button>
      </div>

      {/* 1. STAFF MANAGEMENT TAB */}
      {activeTab === 'employees' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>
              Employee Directory
            </span>
            <button
              onClick={() => {
                setStaffBranch(currentBranchId === 'ALL' ? branches[0]?.id : currentBranchId);
                setShowStaffModal(true);
              }}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              <Plus size={14} /> Add New Staff
            </button>
          </div>

          {/* Pending Approvals */}
          {pendingUsers.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Pending Registration Approvals ({pendingUsers.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingUsers.map(u => (
                  <div key={u.id} style={{ background: '#fffbeb', border: '1.5px solid #fef3c7', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>{u.full_name}</strong>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                        Role: {u.role.toUpperCase()} • Branch: {u.branch_name || u.branch_id}
                      </span>
                    </div>
                    <button onClick={() => handleUserStatus(u.id, 'ACTIVE')} className="btn btn-success" style={{ padding: '6px 12px', fontSize: 12 }}>
                      <CheckCircle size={14} /> Approve
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Users */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.map(u => (
              <div key={u.id} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 13 }}>{u.full_name}</strong>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                    @{u.username} • <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{u.role.toUpperCase()}</span> • {u.branch_name || u.branch_id}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge badge-${u.status === 'ACTIVE' ? 'ready' : 'cancelled'}`}>
                    {u.status}
                  </span>
                  <button
                    onClick={() => {
                      setDirectResetTarget(u);
                      setDirectResetPassword('');
                    }}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer'
                    }}
                    title="Directly reset this user's password"
                  >
                    <Key size={11} color="var(--primary)" />
                    {language === 'am' ? 'የይለፍ ቃል' : 'Password'}
                  </button>
                  {u.role !== 'owner' && (
                    <button
                      onClick={() => handleUserStatus(u.id, u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                      style={{ fontSize: 11, fontWeight: 700, color: u.status === 'ACTIVE' ? 'var(--danger)' : 'var(--accent)' }}
                    >
                      {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. BRANCHES MANAGEMENT TAB */}
      {activeTab === 'branches' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>
              Restaurant Branches
            </span>
            <button
              onClick={() => {
                setEditingBranchId(null);
                setBranchName('');
                setBranchCity('Addis Ababa');
                setBranchAddress('');
                setBranchPhone('');
                setShowBranchModal(true);
              }}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              <Plus size={14} /> Add New Branch
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {branches.map(b => (
              <div key={b.id} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={16} color="var(--primary)" /> {b.name}
                    </h4>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      City: <strong>{b.city}</strong> • VAT: {(b.vat_rate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEditBranch(b)} className="btn btn-secondary" style={{ padding: '4px 8px' }}>
                      <Edit2 size={14} />
                    </button>
                    {branches.length > 1 && (
                      <button onClick={() => handleDeleteBranch(b.id, b.name)} className="btn btn-danger" style={{ padding: '4px 8px' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: 8, borderRadius: 8 }}>
                  Address: {b.address || 'Central Plaza'} • Phone: {b.phone || '+251 9...'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. TABLES & SECTIONS MANAGEMENT TAB */}
      {activeTab === 'tables' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>
              Tables & Restaurant Sections
            </span>
            <button
              onClick={() => {
                setEditingTableId(null);
                setTableNumber('');
                setTableName('');
                setTableSection('Main Dining');
                setCustomSection('');
                setTableCapacity(4);
                setTableBranch(currentBranchId === 'ALL' ? branches[0]?.id : currentBranchId);
                setShowTableModal(true);
              }}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              <Plus size={14} /> Add Table / Section
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {tables.map(tbl => (
              <div key={tbl.id} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)' }}>
                      {tbl.table_number}
                    </span>
                    <span className={`badge badge-${tbl.status === 'AVAILABLE' ? 'ready' : tbl.status === 'OCCUPIED' ? 'cancelled' : 'pending'}`}>
                      {tbl.status}
                    </span>
                  </div>
                  <h5 style={{ fontSize: 13, fontWeight: 700 }}>{tbl.name}</h5>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                    📍 Section: <strong style={{ color: 'var(--text-main)' }}>{tbl.section}</strong>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Capacity: {tbl.capacity} Guests
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                  <button onClick={() => openEditTable(tbl)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>
                    <Edit2 size={13} /> Edit
                  </button>
                  <button onClick={() => handleDeleteTable(tbl.id, tbl.table_number)} className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 11 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. BRANDING & APP NAME SETTINGS TAB */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveBranding} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Settings size={18} color="var(--primary)" /> App Branding & Customization
          </h3>

          <CameraCapture
            label="App & Receipt Brand Logo"
            photoUrl={appLogo}
            onPhotoCaptured={setAppLogo}
            onPhotoCleared={() => setAppLogo(null)}
          />

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              App / Restaurant Display Name
            </label>
            <input
              type="text"
              required
              value={appName}
              onChange={e => setAppName(e.target.value)}
              placeholder="e.g. Habesha Gourmet & Lounge"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Brand Slogan / Header Tagline
            </label>
            <input
              type="text"
              value={appSlogan}
              onChange={e => setAppSlogan(e.target.value)}
              placeholder="e.g. Authentic Taste, Seamless Hospitality"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: 18, background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: 10 }}>
              🎨 Brand Theme Colors (Extracted from Brand Logo)
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Primary (Top Ring & Arrow)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    style={{ width: 40, height: 40, padding: 2, cursor: 'pointer', borderRadius: 8 }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>{primaryColor}</span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Secondary (Bottom Ring Crimson)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={e => setSecondaryColor(e.target.value)}
                    style={{ width: 40, height: 40, padding: 2, cursor: 'pointer', borderRadius: 8 }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>{secondaryColor}</span>
                </div>
              </div>
            </div>

            {/* Quick Logo Palette Swatches */}
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Logo Palette Presets:
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { name: 'Burger Amber', hex: '#ff9e01' },
                  { name: 'Crimson Wine', hex: '#940500' },
                  { name: 'Lettuce Green', hex: '#3db048' },
                  { name: 'Cheddar Gold', hex: '#eac249' },
                  { name: 'Obsidian Noir', hex: '#121117' }
                ].map(sw => (
                  <button
                    key={sw.hex}
                    type="button"
                    onClick={() => setPrimaryColor(sw.hex)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 16,
                      background: 'var(--bg-card)',
                      border: primaryColor.toLowerCase() === sw.hex.toLowerCase() ? '2px solid var(--primary)' : '1px solid var(--border)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: sw.hex, display: 'inline-block' }} />
                    <span>{sw.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Timezone & Clock Configuration Section */}
          <div style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 16
          }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-main)' }}>
              <Clock size={16} color="var(--primary)" />
              {language === 'am' ? 'የሰዓት ሰቅ እና የቀን አቆጣጠር (Timezone Settings)' : 'System Timezone & Clock Settings'}
            </h4>

            {/* Mode Radio Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setAdminTzMode('AUTO')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  background: adminTzMode === 'AUTO' ? 'var(--primary)' : 'var(--bg-card)',
                  color: adminTzMode === 'AUTO' ? '#ffffff' : 'var(--text-main)',
                  border: adminTzMode === 'AUTO' ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Sparkles size={14} />
                {language === 'am' ? 'ራስ-ሰር (Auto)' : 'Automatic'}
              </button>

              <button
                type="button"
                onClick={() => setAdminTzMode('MANUAL')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  background: adminTzMode === 'MANUAL' ? 'var(--primary)' : 'var(--bg-card)',
                  color: adminTzMode === 'MANUAL' ? '#ffffff' : 'var(--text-main)',
                  border: adminTzMode === 'MANUAL' ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Globe size={14} />
                {language === 'am' ? 'በእጅ የተመረጠ (Manual)' : 'Manual Selection'}
              </button>
            </div>

            {adminTzMode === 'AUTO' ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {language === 'am'
                  ? `⚡ ስርዓቱ የመሳሪያውን/የአሳሹን ሰዓት በራስ-ሰር ይከተላል (የአሁኑ መሣሪያ ሰዓት ሰቅ: ${getDeviceTimezone()})`
                  : `⚡ The system automatically aligns with the browser/device timezone (Current device: ${getDeviceTimezone()})`}
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'am' ? 'የስርዓቱ ዋና የሰዓት ሰቅ' : 'Restaurant System Timezone'}
                </label>
                <select
                  value={adminSysTz}
                  onChange={e => setAdminSysTz(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}
                >
                  {TIMEZONE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {language === 'am' ? opt.labelAm : opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Live Clock Preview */}
            <div style={{
              marginTop: 10,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'var(--bg-card)',
              border: '1px dashed var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11
            }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {language === 'am' ? 'የአሁን ሰዓት ቅድመ-ዕይታ:' : 'Live Clock Preview:'}
              </span>
              <strong style={{ color: 'var(--primary)' }}>
                {formatTime(new Date(), true)} ({adminTzMode === 'AUTO' ? getDeviceTimezone() : adminSysTz})
              </strong>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ height: 48 }}>
            {loading ? 'Saving Settings...' : (language === 'am' ? 'ማስተካከያዎቹን መዝግብ' : 'Save Branding & Timezone Settings')}
          </button>
        </form>
      )}

      {/* 4. EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <div>
          <form onSubmit={handleAddExpense} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Record Operational Expense</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Category</label>
                <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} style={{ width: '100%' }}>
                  <option value="Food purchases">Food purchases</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Water">Water</option>
                  <option value="Salaries">Salaries</option>
                  <option value="Rent">Rent</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Cleaning">Cleaning</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Amount ({t('currency')})</label>
                <input type="number" required value={expenseAmount} onChange={e => setExpenseAmount(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
              <input type="text" required placeholder="Details about this expense" value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} style={{ width: '100%' }} />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary btn-block">
              Save Expense
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {expenses.map(e => (
              <div key={e.id} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 13 }}>{e.category}</strong>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{e.description} • {e.expense_date}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--danger)' }}>
                  -{e.amount} {t('currency')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. AUDIT TAB */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {auditLogs.map(log => (
            <div key={log.id} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 10, padding: 10, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ color: 'var(--primary)' }}>{log.action}</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{log.created_at}</span>
              </div>
              <p style={{ color: 'var(--text-main)' }}>By: {log.user_name || 'System'} • {log.details}</p>
            </div>
          ))}
        </div>
      )}

      {/* 6. MENU MANAGEMENT TAB */}
      {activeTab === 'menu' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>
              {language === 'am' ? 'የምግብ ካታሎግ' : 'Menu Catalogue'} ({menuItems.length} items)
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                <FolderPlus size={14} color="var(--primary)" /> {language === 'am' ? 'አዲስ ምድብ' : '+ New Category'}
              </button>
              <button
                onClick={() => {
                  setEditingMenuItemId(null);
                  setMenuName('');
                  setMenuNameAmharic('');
                  setMenuPrice(100);
                  setMenuCategory(categories[0]?.id || 'cat_burgers');
                  setMenuRouting('KITCHEN');
                  setMenuDesc('');
                  setMenuPhoto('');
                  setShowMenuModal(true);
                }}
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800 }}
              >
                <Plus size={14} /> {language === 'am' ? 'ምግብ ጨምር' : 'Add Menu Item'}
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 14 }}>
            <button
              onClick={() => setSelectedCategoryFilter('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 800,
                border: selectedCategoryFilter === 'ALL' ? 'none' : '1px solid var(--border)',
                background: selectedCategoryFilter === 'ALL' ? 'var(--primary)' : 'var(--bg-card)',
                color: selectedCategoryFilter === 'ALL' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {language === 'am' ? 'ሁሉም ምግቦች' : 'All Categories'} ({menuItems.length})
            </button>
            {categories.map(cat => {
              const count = menuItems.filter(m => m.category_id === cat.id).length;
              const isSelected = selectedCategoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryFilter(cat.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    border: isSelected ? 'none' : '1px solid var(--border)',
                    background: isSelected ? 'var(--primary)' : 'var(--bg-card)',
                    color: isSelected ? '#ffffff' : 'var(--text-main)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span>{cat.icon || '🍽️'}</span>
                  <span>{language === 'am' && cat.name_amharic ? cat.name_amharic : cat.name}</span>
                  <span style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-subtle)',
                    color: isSelected ? '#ffffff' : 'var(--text-muted)'
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {menuItems
              .filter(item => selectedCategoryFilter === 'ALL' || item.category_id === selectedCategoryFilter)
              .map(item => (
              <div
                key={item.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 12,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {/* Thumbnail */}
                <div style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg, #f97316, #ea580c)', position: 'relative' }}>
                  {item.photo_url ? (
                    <img
                      src={resolveImageUrl(item.photo_url)}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.parentElement?.querySelector('.admin-item-fallback') as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="admin-item-fallback"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: item.photo_url ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 20
                    }}
                  >
                    {item.name.charAt(0)}
                  </div>
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                    <h5 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{item.name}</h5>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: item.routing_destination === 'KITCHEN' ? '#fef3c7' : item.routing_destination === 'BAR' ? '#e0f2fe' : item.routing_destination === 'BAKERY' ? '#fdf2f8' : item.routing_destination === 'FRONT_COUNTER' ? '#f0fdf4' : '#f3e8ff',
                      color: item.routing_destination === 'KITCHEN' ? '#b45309' : item.routing_destination === 'BAR' ? '#0284c7' : item.routing_destination === 'BAKERY' ? '#be185d' : item.routing_destination === 'FRONT_COUNTER' ? '#15803d' : '#7e22ce'
                    }}>
                      {item.routing_destination}
                    </span>
                    {item.category_name && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                        {item.category_name}
                      </span>
                    )}
                  </div>
                  {item.name_amharic && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>{item.name_amharic}</span>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)' }}>
                      {item.price} {t('currency')}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEditMenuItem(item)} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: 11 }}>
                        <Edit2 size={12} /> Edit
                      </button>
                      <button onClick={() => handleDeleteMenuItem(item.id, item.name)} className="btn btn-danger" style={{ padding: '3px 8px', fontSize: 11 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. ANALYTICS & DEEP REPORTS TAB */}
      {activeTab === 'analytics' && (
        <div style={{ marginTop: 10 }}>
          <DetailedReportsDashboard branchId={currentBranchId} isEmbedded />
        </div>
      )}

      {/* 8. ACCOUNT & PASSWORD REQUESTS TAB (STRICT ADMIN/OWNER APPROVAL) */}
      {activeTab === 'accountRequests' && (
        <div className="animate-fade-in">
          {/* Header & Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <ShieldCheck size={20} color="var(--primary)" />
                {language === 'am' ? 'የይለፍ ቃልና የመረጃ ጥያቄዎች ማረጋገጫ' : 'Staff Account & Password Approvals'}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                {language === 'am' 
                  ? 'የተረሱ የይለፍ ቃላት እና የመረጃ ለውጦች በአስተዳዳሪው ወይም በባለቤቱ ማረጋገጫ ብቻ ይፀድቃሉ።' 
                  : 'All staff forgot-password and profile modification requests require strict Admin/Owner approval.'}
              </p>
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: 6, background: 'var(--bg-subtle)', padding: 4, borderRadius: 10, overflowX: 'auto' }}>
              {(['PENDING', 'ALL', 'APPROVED', 'REJECTED'] as const).map(flt => {
                const count = flt === 'ALL' 
                  ? accountRequests.length 
                  : accountRequests.filter(r => r.status === flt).length;
                return (
                  <button
                    key={flt}
                    onClick={() => setAccountRequestsFilter(flt)}
                    style={{
                      padding: '5px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: 'none',
                      background: accountRequestsFilter === flt ? 'var(--primary)' : 'transparent',
                      color: accountRequestsFilter === flt ? '#ffffff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span>
                      {flt === 'PENDING' ? (language === 'am' ? 'በመጠባበቅ ላይ' : 'Pending') :
                       flt === 'ALL' ? (language === 'am' ? 'ሁሉም' : 'All') :
                       flt === 'APPROVED' ? (language === 'am' ? 'የፀደቁ' : 'Approved') :
                       (language === 'am' ? 'ውድቅ' : 'Rejected')}
                    </span>
                    <span style={{
                      background: accountRequestsFilter === flt ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: 10
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of Requests */}
          {accountRequests.filter(r => accountRequestsFilter === 'ALL' || r.status === accountRequestsFilter).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed var(--border)' }}>
              <ShieldAlert size={36} color="var(--text-muted)" style={{ opacity: 0.6, marginBottom: 8 }} />
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
                {language === 'am' ? 'ምንም ጥያቄ አልተገኘም' : 'No Account Requests Found'}
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                {accountRequestsFilter === 'PENDING'
                  ? (language === 'am' ? 'በአሁኑ ጊዜ ማረጋገጫ የሚጠብቅ የይለፍ ቃል ወይም የመረጃ ጥያቄ የለም።' : 'There are currently no requests awaiting your approval.')
                  : (language === 'am' ? 'በዚህ ማጣሪያ ስር የተመዘገበ ጥያቄ የለም።' : 'No records under this filter.')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
              {accountRequests
                .filter(r => accountRequestsFilter === 'ALL' || r.status === accountRequestsFilter)
                .map(req => {
                  let changes: any = {};
                  try {
                    changes = typeof req.requested_changes === 'string' ? JSON.parse(req.requested_changes) : (req.requested_changes || {});
                  } catch (_) {}

                  const isPending = req.status === 'PENDING';
                  const isApproved = req.status === 'APPROVED';

                  const typeLabel = 
                    req.request_type === 'FORGOT_PASSWORD' ? (language === 'am' ? '🔑 የይለፍ ቃል ተረስቷል' : '🔑 Forgot Password') :
                    req.request_type === 'PASSWORD_CHANGE' ? (language === 'am' ? '🔒 የይለፍ ቃል ለውጥ' : '🔒 Password Change') :
                    req.request_type === 'PROFILE_UPDATE' ? (language === 'am' ? '👤 የመረጃ ለውጥ' : '👤 Profile Info') :
                    (language === 'am' ? '👤+🔒 መረጃ እና የይለፍ ቃል' : '👤+🔒 Profile & Password');

                  const statusBadgeColor = isPending ? '#b45309' : isApproved ? '#15803d' : '#b91c1c';
                  const statusBadgeBg = isPending ? '#fef3c7' : isApproved ? '#dcfce7' : '#fee2e2';

                  return (
                    <div
                      key={req.id}
                      style={{
                        background: 'var(--bg-card)',
                        border: isPending ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                        borderRadius: 16,
                        padding: 16,
                        boxShadow: isPending ? '0 4px 14px rgba(245, 158, 11, 0.12)' : 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      {/* Top Bar: Type & Status */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-main)' }}>
                            {typeLabel}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: statusBadgeBg, color: statusBadgeColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {isPending && <Clock size={11} />}
                            {isApproved && <CheckCircle size={11} />}
                            {!isPending && !isApproved && <XCircle size={11} />}
                            {req.status}
                          </span>
                        </div>

                        {/* User identity */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                            color: '#ffffff',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            flexShrink: 0
                          }}>
                            {(req.full_name || req.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
                              {req.full_name || req.username}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              @{req.username} • <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{req.role?.toUpperCase()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Details Card */}
                        <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: 10, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {changes.contact && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>📞 አድራሻ / Contact: </span>
                              <strong style={{ color: 'var(--text-main)' }}>{changes.contact}</strong>
                            </div>
                          )}
                          {changes.new_full_name && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>👤 አዲስ ስም (New Name): </span>
                              <strong style={{ color: 'var(--text-main)' }}>{changes.new_full_name}</strong>
                            </div>
                          )}
                          {changes.new_phone && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>📱 አዲስ ስልክ (New Phone): </span>
                              <strong style={{ color: 'var(--text-main)' }}>{changes.new_phone}</strong>
                            </div>
                          )}
                          {(changes.desired_password || changes.new_password) && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>🔐 የተጠየቀ የይለፍ ቃል: </span>
                                <strong style={{ color: '#0284c7', letterSpacing: 1 }}>{changes.desired_password || changes.new_password}</strong>
                              </div>
                              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                                Requested
                              </span>
                            </div>
                          )}
                          {changes.reason && (
                            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 6, marginTop: 2, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                              "{changes.reason}"
                            </div>
                          )}
                        </div>

                        {/* Audit / Review Info */}
                        {req.reviewed_by_name && (
                          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                            <div>
                              {language === 'am' ? 'የገመገመው፡' : 'Reviewed by:'} <strong>{req.reviewed_by_name}</strong> • {formatTime(req.updated_at)}
                            </div>
                            {req.admin_notes && (
                              <div style={{ fontStyle: 'italic', marginTop: 2 }}>"{req.admin_notes}"</div>
                            )}
                          </div>
                        )}
                        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                          {language === 'am' ? 'የተላከው፡' : 'Requested at:'} {formatTime(req.created_at)}
                        </div>
                      </div>

                      {/* Action Buttons for Pending */}
                      {isPending ? (
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <button
                            onClick={() => {
                              setSelectedReqForApproval(req);
                              setAdminPassOverride(changes.desired_password || changes.new_password || '');
                              setAdminReviewNote('');
                            }}
                            className="btn btn-success"
                            style={{ flex: 1, padding: '8px 10px', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            <UserCheck size={14} />
                            {language === 'am' ? 'ፍቀድና ቀይር' : 'Approve'}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReqForRejection(req);
                              setAdminReviewNote('');
                            }}
                            className="btn btn-danger"
                            style={{ padding: '8px 12px', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          >
                            <UserX size={14} />
                            {language === 'am' ? 'ውድቅ' : 'Reject'}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => {
                              setDirectResetTarget({ id: req.user_id, username: req.username, full_name: req.full_name, role: req.role });
                              setDirectResetPassword('');
                            }}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              padding: '4px 8px',
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: 'pointer'
                            }}
                          >
                            <Key size={11} /> {language === 'am' ? 'ቀጥታ የይለፍ ቃል ቀይር' : 'Direct Reset'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD STAFF */}
      {showStaffModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>Create New Staff Member</h3>
              <button onClick={() => setShowStaffModal(false)} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Full Name</label>
                <input type="text" required placeholder="e.g. Selamawit Desta" value={staffName} onChange={e => setStaffName(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Username</label>
                <input type="text" required placeholder="e.g. selam.d" value={staffUsername} onChange={e => setStaffUsername(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Password</label>
                <input type="password" required value={staffPassword} onChange={e => setStaffPassword(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Assigned Role</label>
                  <select value={staffRole} onChange={e => setStaffRole(e.target.value as any)} style={{ width: '100%' }}>
                    <option value="waiter">Waiter</option>
                    <option value="cashier">Cashier</option>
                    <option value="chef">Chef</option>
                    <option value="barista">Barista</option>
                    <option value="storekeeper">Storekeeper</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Branch</label>
                  <select value={staffBranch} onChange={e => setStaffBranch(e.target.value)} style={{ width: '100%' }}>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Phone (Optional)</label>
                  <input type="tel" placeholder="+251 9..." value={staffPhone} onChange={e => setStaffPhone(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Employee ID</label>
                  <input type="text" placeholder="EMP-204" value={staffEmpId} onChange={e => setStaffEmpId(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ height: 46, marginTop: 6 }}>
                {loading ? 'Creating...' : 'Create & Activate Staff'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT BRANCH */}
      {showBranchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{editingBranchId ? 'Edit Restaurant Branch' : 'Add New Restaurant Branch'}</h3>
              <button onClick={() => setShowBranchModal(false)} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleSaveBranch} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Branch Name</label>
                <input type="text" required placeholder="e.g. Hawassa Lakeside Branch" value={branchName} onChange={e => setBranchName(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>City</label>
                  <input type="text" required placeholder="e.g. Hawassa" value={branchCity} onChange={e => setBranchCity(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>VAT Rate (0.15 = 15%)</label>
                  <input type="number" step="0.01" required value={branchVatRate} onChange={e => setBranchVatRate(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Address / Location</label>
                <input type="text" placeholder="e.g. Lake View Boulevard" value={branchAddress} onChange={e => setBranchAddress(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Branch Phone</label>
                <input type="tel" placeholder="+251 9..." value={branchPhone} onChange={e => setBranchPhone(e.target.value)} style={{ width: '100%' }} />
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ height: 46, marginTop: 6 }}>
                {loading ? 'Saving...' : editingBranchId ? 'Save Branch Changes' : 'Create Branch'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT TABLE & SECTION */}
      {showTableModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{editingTableId ? 'Edit Table & Section' : 'Create Table & Section'}</h3>
              <button onClick={() => setShowTableModal(false)} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleSaveTable} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Table Number / Code</label>
                  <input type="text" required placeholder="e.g. T-12, VIP-3" value={tableNumber} onChange={e => setTableNumber(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Table Name</label>
                  <input type="text" placeholder="e.g. Table 12" value={tableName} onChange={e => setTableName(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Restaurant Area / Section</label>
                <select value={tableSection} onChange={e => setTableSection(e.target.value)} style={{ width: '100%', marginBottom: tableSection === 'CUSTOM' ? 8 : 0 }}>
                  <option value="Main Dining">Main Dining Hall</option>
                  <option value="Window View">Window View</option>
                  <option value="Balcony">Balcony Terrace</option>
                  <option value="VIP Lounge">VIP Private Suite</option>
                  <option value="Cocktail & Coffee Bar">Cocktail & Coffee Bar</option>
                  <option value="Outdoor Garden">Outdoor Garden</option>
                  <option value="CUSTOM">+ Create New Custom Section...</option>
                </select>

                {tableSection === 'CUSTOM' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter new custom section name (e.g. Rooftop Sky Lounge)"
                    value={customSection}
                    onChange={e => setCustomSection(e.target.value)}
                    style={{ width: '100%' }}
                  />
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Seating Capacity</label>
                  <input type="number" min="1" max="50" required value={tableCapacity} onChange={e => setTableCapacity(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Branch</label>
                  <select value={tableBranch} onChange={e => setTableBranch(e.target.value)} style={{ width: '100%' }}>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ height: 46, marginTop: 6 }}>
                {loading ? 'Saving Table...' : editingTableId ? 'Save Table Changes' : 'Create Table & Section'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT MENU ITEM */}
      {showMenuModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)' }} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>{editingMenuItemId ? 'Edit Menu Item' : 'Add New Menu Item'}</h3>
              <button onClick={() => setShowMenuModal(false)} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleSaveMenuItem} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Item Name (English)</label>
                <input type="text" required placeholder="e.g. Gourmet Double Beef Burger" value={menuName} onChange={e => setMenuName(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Item Name (Amharic - Optional)</label>
                <input type="text" placeholder="e.g. ዳብል የበሬ በርገር" value={menuNameAmharic} onChange={e => setMenuNameAmharic(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                      {language === 'am' ? 'ምድብ (Category)' : 'Category'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCategoryModal(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                        padding: 0
                      }}
                    >
                      <Plus size={11} /> {language === 'am' ? 'አዲስ ምድብ' : 'New'}
                    </button>
                  </div>
                  <select
                    value={menuCategory}
                    onChange={e => {
                      if (e.target.value === '__NEW__') {
                        setShowCategoryModal(true);
                      } else {
                        setMenuCategory(e.target.value);
                      }
                    }}
                    style={{ width: '100%' }}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ''}{c.name} {c.name_amharic ? `(${c.name_amharic})` : ''}
                      </option>
                    ))}
                    <option value="__NEW__">+ {language === 'am' ? 'አዲስ ምድብ ፍጠር...' : 'Create New Category...'}</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Price ({t('currency')})</label>
                  <input type="number" min="0" step="0.5" required value={menuPrice} onChange={e => setMenuPrice(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Preparation Routing</label>
                <select value={menuRouting} onChange={e => setMenuRouting(e.target.value as any)} style={{ width: '100%' }}>
                  <option value="KITCHEN">🍳 KITCHEN (Main Cooking Station)</option>
                  <option value="BAR">☕ BAR (Drinks & Coffee Station)</option>
                  <option value="BOTH">⚡ BOTH (Split Stations)</option>
                  <option value="BAKERY">🍰 BAKERY (Bakery & Pastry Kitchen / የዳቦና ኬክ ክፍል)</option>
                  <option value="FRONT_COUNTER">🧁 FRONT COUNTER (Cake Display / የፊት ኬክ ካውንተር)</option>
                </select>
              </div>

              <ImageUploadCompressor
                value={menuPhoto}
                onChange={setMenuPhoto}
                label={language === 'am' ? 'የምግብ ፎቶ (ከተንቀሳቃሽ ስልክ ወይም ፋይል)' : 'Dish Photo (Mobile Camera or Upload)'}
              />

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea rows={2} placeholder="Ingredients, recipe notes, allergens..." value={menuDesc} onChange={e => setMenuDesc(e.target.value)} style={{ width: '100%' }} />
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ height: 46, marginTop: 6 }}>
                {loading ? 'Saving Item...' : editingMenuItemId ? 'Save Changes' : 'Create Menu Item'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: APPROVE ACCOUNT / PASSWORD REQUEST */}
      {selectedReqForApproval && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 22, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-floating)' }} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 17, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                  <UserCheck size={18} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                  {language === 'am' ? 'ጥያቄውን አጽድቅና ለውጡን ተግብር' : 'Approve Request & Apply Changes'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReqForApproval(null)}
                style={{ background: 'transparent', border: 'none', fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                {selectedReqForApproval.full_name || selectedReqForApproval.username}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                @{selectedReqForApproval.username} • Role: {selectedReqForApproval.role?.toUpperCase()}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* If password requested or changed */}
              {(selectedReqForApproval.request_type === 'FORGOT_PASSWORD' || 
                selectedReqForApproval.request_type === 'PASSWORD_CHANGE' || 
                selectedReqForApproval.request_type === 'PROFILE_AND_PASSWORD') && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? 'የይለፍ ቃል ማስተካከያ (Admin Password Override)' : 'Admin Password (Optional Override)'}
                  </label>
                  <input
                    type="text"
                    placeholder={language === 'am' ? 'ከተፈለገ የተለየ የይለፍ ቃል ያስገቡ (አማራጭ)' : 'Leave empty to use user requested password'}
                    value={adminPassOverride}
                    onChange={e => setAdminPassOverride(e.target.value)}
                    style={{ width: '100%', fontFamily: 'monospace' }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                    {language === 'am' ? 'ባዶ ከተተወ ሰራተኛው የጠየቀው የይለፍ ቃል ይቀመጣል።' : 'If left blank, the password requested by the employee will be applied.'}
                  </span>
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'am' ? 'የአስተዳዳሪ ማስታወሻ (Admin Note - Optional)' : 'Admin Note / Confirmation Message'}
                </label>
                <textarea
                  rows={2}
                  placeholder={language === 'am' ? 'ለምሳሌ፡ በአካል ተረጋግጦ ጸድቋል...' : 'e.g. Identity verified in person...'}
                  value={adminReviewNote}
                  onChange={e => setAdminReviewNote(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setSelectedReqForApproval(null)}
                  disabled={isProcessingAction}
                  className="btn btn-secondary"
                  style={{ flex: 1, height: 42 }}
                >
                  {language === 'am' ? 'ተመለስ' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleApproveRequest}
                  disabled={isProcessingAction}
                  className="btn btn-success"
                  style={{ flex: 2, height: 42, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <CheckCircle size={16} />
                  {isProcessingAction 
                    ? (language === 'am' ? 'በማጽደቅ ላይ...' : 'Approving...') 
                    : (language === 'am' ? 'አረጋግጥና አጽድቅ' : 'Confirm & Apply')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REJECT ACCOUNT / PASSWORD REQUEST */}
      {selectedReqForRejection && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 22, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-floating)' }} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 17, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                  <UserX size={18} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: '#dc2626' }}>
                  {language === 'am' ? 'ጥያቄውን ውድቅ አድርግ' : 'Reject Account Request'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReqForRejection(null)}
                style={{ background: 'transparent', border: 'none', fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                {selectedReqForRejection.full_name || selectedReqForRejection.username}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                @{selectedReqForRejection.username} • Role: {selectedReqForRejection.role?.toUpperCase()}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'am' ? 'ውድቅ የተደረገበት ምክንያት (Reason for Rejection)' : 'Reason for Rejection *'}
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder={language === 'am' ? 'ለምሳሌ፡ መረጃው ትክክል አይደለም ወይም ማረጋገጫ አልተገኘም...' : 'Please specify why this request is rejected...'}
                  value={adminReviewNote}
                  onChange={e => setAdminReviewNote(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setSelectedReqForRejection(null)}
                  disabled={isProcessingAction}
                  className="btn btn-secondary"
                  style={{ flex: 1, height: 42 }}
                >
                  {language === 'am' ? 'ተመለስ' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleRejectRequest}
                  disabled={isProcessingAction}
                  className="btn btn-danger"
                  style={{ flex: 2, height: 42, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <XCircle size={16} />
                  {isProcessingAction 
                    ? (language === 'am' ? 'በማስወገድ ላይ...' : 'Rejecting...') 
                    : (language === 'am' ? 'ውድቅ አድርግ' : 'Confirm Rejection')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DIRECT STAFF PASSWORD RESET */}
      {directResetTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 22, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-floating)' }} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 17, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                  <Key size={18} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                  {language === 'am' ? 'የሰራተኛ የይለፍ ቃል ቀጥታ መቀየሪያ' : 'Direct Staff Password Reset'}
                </h3>
              </div>
              <button
                onClick={() => setDirectResetTarget(null)}
                style={{ background: 'transparent', border: 'none', fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                {directResetTarget.full_name || directResetTarget.username}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                @{directResetTarget.username} • Role: {directResetTarget.role?.toUpperCase()}
              </div>
            </div>

            <form onSubmit={handleDirectPasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'am' ? 'አዲስ የይለፍ ቃል (New Password)' : 'New Password * (min 6 characters)'}
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bakery#2026"
                    value={directResetPassword}
                    onChange={e => setDirectResetPassword(e.target.value)}
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const randomPass = 'Staff' + Math.floor(100000 + Math.random() * 900000);
                      setDirectResetPassword(randomPass);
                    }}
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '0 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    title="Generate a quick temporary password"
                  >
                    🎲 Auto
                  </button>
                </div>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 8, fontSize: 11, color: '#166534' }}>
                💡 {language === 'am'
                  ? 'ይህ እርምጃ ወዲያውኑ የይለፍ ቃሉን ይቀይራል እንዲሁም የተቆለፈ አካውንት ካለ ይከፍታል።'
                  : 'This directly resets password and immediately unlocks account if locked.'}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setDirectResetTarget(null)}
                  disabled={isDirectResetting}
                  className="btn btn-secondary"
                  style={{ flex: 1, height: 42 }}
                >
                  {language === 'am' ? 'ተመለስ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isDirectResetting || directResetPassword.trim().length < 6}
                  className="btn btn-primary"
                  style={{ flex: 2, height: 42, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Key size={15} />
                  {isDirectResetting 
                    ? (language === 'am' ? 'በመቀየር ላይ...' : 'Resetting...') 
                    : (language === 'am' ? 'የይለፍ ቃል ቀይር' : 'Reset Password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE CATEGORY */}
      <CreateCategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoryCreated={(newCat) => {
          setCategories(prev => {
            if (prev.some(c => c.id === newCat.id)) return prev;
            return [...prev, newCat];
          });
          setMenuCategory(newCat.id);
        }}
      />
    </div>
  );
};

