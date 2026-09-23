import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { CameraCapture } from '../../components/CameraCapture';
import { ImageUploadCompressor } from '../../components/ImageUploadCompressor';
import { DetailedReportsDashboard } from '../../components/DetailedReportsDashboard';
import { resolveImageUrl } from '../../utils/imageUrl';
import { Users, DollarSign, FileText, CheckCircle, XCircle, AlertCircle, Building2, Plus, Edit2, Trash2, Settings, Shield, Utensils, BarChart3 } from 'lucide-react';
import { gToast } from '../../utils/toast';

export const AdminView: React.FC = () => {
  const { currentBranchId, branches, refreshBranches, settings, refreshSettings, t, language } = useApp();
  const [activeTab, setActiveTab] = useState<'employees' | 'branches' | 'tables' | 'settings' | 'expenses' | 'audit' | 'menu' | 'analytics'>('employees');
  const [users, setUsers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Menu Management State
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingMenuItemId, setEditingMenuItemId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState('');
  const [menuNameAmharic, setMenuNameAmharic] = useState('');
  const [menuPrice, setMenuPrice] = useState<number>(100);
  const [menuCategory, setMenuCategory] = useState('');
  const [menuRouting, setMenuRouting] = useState<'KITCHEN' | 'BAR' | 'BOTH'>('KITCHEN');
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
  const [appName, setAppName] = useState(settings?.restaurant_name || 'GourmetOS Restaurant & Lounge');
  const [appSlogan, setAppSlogan] = useState(settings?.slogan || 'Exquisite Taste & Seamless Hospitality');
  const [appLogo, setAppLogo] = useState<string | null>(settings?.logo_url || null);
  const [primaryColor, setPrimaryColor] = useState(settings?.primary_color || '#f97316');

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
  }, [currentBranchId]);

  useEffect(() => {
    if (settings) {
      setAppName(settings.restaurant_name);
      setAppSlogan(settings.slogan || '');
      setAppLogo(settings.logo_url || null);
      setPrimaryColor(settings.primary_color || '#f97316');
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

  // 3. Save Branding / App Name & Logo
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.request('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          restaurant_name: appName,
          slogan: appSlogan,
          logo_url: appLogo,
          primary_color: primaryColor
        })
      });
      refreshSettings();
      gToast.success('Restaurant Branding & App Name updated successfully!');
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

  const pendingUsers = users.filter(u => u.status === 'PENDING_APPROVAL');

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

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Primary Brand Accent Color
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                style={{ width: 44, height: 44, padding: 2, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{primaryColor}</span>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ height: 48 }}>
            {loading ? 'Saving Branding...' : 'Update App Name & Branding'}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>
              Menu Catalogue ({menuItems.length} items)
            </span>
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
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              <Plus size={14} /> Add Menu Item
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {menuItems.map(item => (
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
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: item.routing_destination === 'KITCHEN' ? '#fef3c7' : '#e0f2fe', color: item.routing_destination === 'KITCHEN' ? '#b45309' : '#0284c7' }}>
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
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Category</label>
                  <select value={menuCategory} onChange={e => setMenuCategory(e.target.value)} style={{ width: '100%' }}>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
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
    </div>
  );
};

