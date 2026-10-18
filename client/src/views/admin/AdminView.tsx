import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { CameraCapture } from '../../components/CameraCapture';
import { ImageUploadCompressor } from '../../components/ImageUploadCompressor';
import { DetailedReportsDashboard } from '../../components/DetailedReportsDashboard';
import { resolveImageUrl } from '../../utils/imageUrl';
import { compressImageFile } from '../../utils/imageCompressor';
import { CreateCategoryModal } from '../../components/CreateCategoryModal';
import { Users, DollarSign, FileText, CheckCircle, XCircle, AlertCircle, AlertTriangle, Building2, Plus, Edit2, Trash2, Settings, Shield, Utensils, BarChart3, FolderPlus, Tag, Clock, Sparkles, Globe, Key, Lock, ShieldCheck, ShieldAlert, UserCheck, UserX, Camera, RefreshCw, X, History, Eye, EyeOff, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { TIMEZONE_OPTIONS, getDeviceTimezone } from '../../utils/timezone';
import { gToast } from '../../utils/toast';
import { tactileFeedback } from '../../utils/feedback';
import { ModalPortal } from '../../components/ModalPortal';
import { AiAssistantModal } from '../../components/AiAssistantModal';
import { CustomerFeedbackDashboard } from './CustomerFeedbackDashboard';

export const AdminView: React.FC = () => {
  const { 
    user, updateUser,
    currentBranchId, branches, refreshBranches, settings, refreshSettings, 
    t, language, setTimezoneMode, setSelectedTimezone, activeTimezone, formatTime 
  } = useApp();
  const [activeTab, setActiveTab] = useState<'employees' | 'branches' | 'tables' | 'settings' | 'expenses' | 'audit' | 'menu' | 'analytics' | 'accountRequests' | 'feedback'>('employees');
  const [users, setUsers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // Menu Management State
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [showCategoryManagerModal, setShowCategoryManagerModal] = useState(false);
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
  const [isSeedingMenu, setIsSeedingMenu] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -220 : 220,
        behavior: 'smooth'
      });
    }
  };

  // Table & Section Management State
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [tableName, setTableName] = useState('');
  const [tableSection, setTableSection] = useState('Restaurant 1');
  const [customSection, setCustomSection] = useState('');
  const [tableCapacity, setTableCapacity] = useState<number>(4);
  const [tableBranch, setTableBranch] = useState(currentBranchId);
  const [isSeedingTables, setIsSeedingTables] = useState(false);
  const [selectedAdminSectionFilter, setSelectedAdminSectionFilter] = useState<string>('ALL');

  // Staff Creation & Photo Upload State
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('password123');
  const [staffRole, setStaffRole] = useState<'superadmin' | 'waiter' | 'cashier' | 'chef' | 'barista' | 'storekeeper' | 'bakery' | 'front_counter' | 'admin'>('waiter');
  const [staffBranch, setStaffBranch] = useState(currentBranchId);
  const [staffPhone, setStaffPhone] = useState('');
  const [staffEmpId, setStaffEmpId] = useState('');
  const [staffPhoto, setStaffPhoto] = useState<string>('');
  const staffPhotoFileInputRef = useRef<HTMLInputElement>(null);
  const [editingPhotoStaffId, setEditingPhotoStaffId] = useState<string | null>(null);
  const [uploadingStaffPhotoId, setUploadingStaffPhotoId] = useState<string | null>(null);

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

  // Staff Order History Visibility State
  const ALL_STAFF_ROLES = [
    { id: 'waiter', label: 'Waiter / አገልጋይ', icon: '🍽️' },
    { id: 'cashier', label: 'Cashier / ሂሳብ ተቀባይ', icon: '💵' },
    { id: 'chef', label: 'Kitchen Chef / ማብሰያ', icon: '🔥' },
    { id: 'barista', label: 'Barista / መጠጥ', icon: '☕' },
    { id: 'bakery', label: 'Bakery / ኬክ ማብሰያ', icon: '🍰' },
    { id: 'front_counter', label: 'Cake Counter / ኬክ ካውንተር', icon: '🧁' },
    { id: 'storekeeper', label: 'Storekeeper / ስቶክ', icon: '📦' }
  ];

  const [staffHistoryVisible, setStaffHistoryVisible] = useState<boolean>(settings?.staff_history_visible !== 0);
  const [staffHistoryRoles, setStaffHistoryRoles] = useState<string[]>(() => {
    if (settings?.staff_history_roles) {
      try {
        const parsed = typeof settings.staff_history_roles === 'string'
          ? JSON.parse(settings.staff_history_roles)
          : settings.staff_history_roles;
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return ['waiter', 'cashier', 'chef', 'barista', 'bakery', 'front_counter', 'storekeeper'];
  });
  const [isUpdatingHistoryConfig, setIsUpdatingHistoryConfig] = useState(false);

  useEffect(() => {
    if (settings) {
      if (settings.restaurant_name) setAppName(settings.restaurant_name);
      if (settings.slogan) setAppSlogan(settings.slogan);
      if (settings.logo_url) setAppLogo(settings.logo_url);
      if (settings.primary_color) setPrimaryColor(settings.primary_color);
      if (settings.secondary_color) setSecondaryColor(settings.secondary_color);
      if (settings.timezone_mode) setAdminTzMode(settings.timezone_mode);
      if (settings.system_timezone) setAdminSysTz(settings.system_timezone);
      if (settings.staff_history_visible !== undefined) {
        setStaffHistoryVisible(settings.staff_history_visible !== 0);
      }
      if (settings.staff_history_roles) {
        try {
          const parsed = typeof settings.staff_history_roles === 'string'
            ? JSON.parse(settings.staff_history_roles)
            : settings.staff_history_roles;
          if (Array.isArray(parsed)) setStaffHistoryRoles(parsed);
        } catch {}
      }
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

  // Clean Demo Data State (Client Handover)
  const [isCleaningDemo, setIsCleaningDemo] = useState(false);
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleanConfirmText, setCleanConfirmText] = useState('');

  // Super Admin Master Control & Telemetry State
  const [superAdminStats, setSuperAdminStats] = useState<any | null>(null);
  const [isOptimizingDb, setIsOptimizingDb] = useState(false);

  // Expense form
  const [expenseCategory, setExpenseCategory] = useState('Electricity');
  const [expenseAmount, setExpenseAmount] = useState<number>(500);
  const [expenseDescription, setExpenseDescription] = useState('');

  const loadSuperAdminStats = () => {
    if (user?.role === 'superadmin') {
      api.request<any>('/admin/superadmin/system-stats')
        .then(res => {
          if (res?.success) setSuperAdminStats(res.stats);
        })
        .catch(() => {});
    }
  };

  const handleOptimizeDatabase = async () => {
    try {
      setIsOptimizingDb(true);
      tactileFeedback('click');
      await api.request('/admin/superadmin/maintenance/optimize', { method: 'POST' });
      gToast.success(language === 'am' ? 'ዳታቤዝ በተሳካ ሁኔታ ተስተካክሎ ተጠርጓል!' : 'Database optimized and vacuumed successfully!');
      loadSuperAdminStats();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to optimize database');
    } finally {
      setIsOptimizingDb(false);
    }
  };

  const loadData = () => {
    api.request<any[]>('/admin/users').then(setUsers).catch(() => {});
    api.request<any[]>(`/expenses?branchId=${currentBranchId}`).then(setExpenses).catch(() => {});
    api.request<any[]>(`/admin/audit-logs?branchId=${currentBranchId}`).then(setAuditLogs).catch(() => {});
    api.request<any[]>(`/tables?branchId=${currentBranchId}`).then(setTables).catch(() => {});
    api.request<any[]>('/menu/items?all=true').then(setMenuItems).catch(() => {});
    api.request<any[]>('/menu/categories').then(setCategories).catch(() => {});
    api.request<any[]>('/auth/admin/account-requests').then(setAccountRequests).catch(() => {});
    loadSuperAdminStats();
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

  const handleSeedOfficialTables = async () => {
    const confirmMsg = language === 'am'
      ? 'ሁሉንም 6 ክፍሎች እና 51 ኦፊሴላዊ ጠረጴዛዎችን ወደ ነበረበት መመለስ ይፈልጋሉ?'
      : 'Do you want to restore/sync all 6 official sections and 51 tables?';
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsSeedingTables(true);
      tactileFeedback('click');
      await api.request('/admin/seed-official-tables', {
        method: 'POST',
        body: JSON.stringify({ branchId: currentBranchId })
      });
      gToast.success(language === 'am' ? 'ኦፊሴላዊ ጠረጴዛዎች (51) በተሳካ ሁኔታ ተጭነዋል!' : 'Official tables (51) restored successfully!');
      await loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to restore official tables');
    } finally {
      setIsSeedingTables(false);
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

  // 1. Create or Edit Staff
  const openEditStaffModal = (u: any) => {
    setEditingStaffId(u.id);
    setStaffName(u.full_name || '');
    setStaffUsername(u.username || '');
    setStaffPassword('');
    setStaffRole(u.role || 'waiter');
    setStaffBranch(u.branch_id || (currentBranchId === 'ALL' ? branches[0]?.id : currentBranchId));
    setStaffPhone(u.phone || '');
    setStaffEmpId(u.employee_id || '');
    setStaffPhoto(u.profile_photo || '');
    setShowStaffModal(true);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingStaffId) {
        // Edit existing staff member
        const payload: any = {
          full_name: staffName,
          username: staffUsername,
          role: staffRole,
          branch_id: staffBranch,
          phone: staffPhone || null,
          employee_id: staffEmpId || null,
          profile_photo: staffPhoto.trim() || null
        };
        if (staffPassword && staffPassword.trim().length >= 6) {
          payload.password = staffPassword.trim();
        }
        await api.request(`/admin/users/${editingStaffId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        gToast.success(language === 'am' ? 'የሠራተኛው መረጃ በተሳካ ሁኔታ ተሻሽሏል!' : 'Staff member updated successfully!');
      } else {
        // Create new staff member
        await api.request('/admin/users', {
          method: 'POST',
          body: JSON.stringify({
            full_name: staffName,
            username: staffUsername,
            password: staffPassword,
            role: staffRole,
            branch_id: staffBranch,
            phone: staffPhone || undefined,
            employee_id: staffEmpId || undefined,
            profile_photo: staffPhoto.trim() || undefined
          })
        });
        gToast.success(language === 'am' ? 'ሠራተኛው በተሳካ ሁኔታ ተመዝግቧል!' : 'Staff member created and activated successfully!');
      }
      setShowStaffModal(false);
      setEditingStaffId(null);
      setStaffName('');
      setStaffUsername('');
      setStaffPhone('');
      setStaffEmpId('');
      setStaffPhoto('');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || (editingStaffId ? 'Failed to update staff member' : 'Failed to create staff member'));
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerStaffPhotoUpload = (userId: string) => {
    setEditingPhotoStaffId(userId);
    staffPhotoFileInputRef.current?.click();
  };

  const handleStaffPhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetUserId = editingPhotoStaffId;
    if (!file || !targetUserId) return;

    if (!file.type.startsWith('image/')) {
      gToast.error('Please select a valid image file');
      return;
    }

    setUploadingStaffPhotoId(targetUserId);
    tactileFeedback('click');
    try {
      const res = await compressImageFile(file, {
        maxWidth: 600,
        maxHeight: 600,
        quality: 0.78,
        format: 'image/jpeg'
      });

      let photoUrl = res.dataUrl;
      try {
        const uploadRes = await api.request<{ url: string }>('/upload', {
          method: 'POST',
          body: JSON.stringify({
            dataUrl: res.dataUrl,
            filename: `staff_${targetUserId}_${Date.now()}.jpg`
          })
        });
        if (uploadRes?.url) {
          photoUrl = uploadRes.url;
        }
      } catch (uploadErr) {
        console.warn('Fallback to dataUrl:', uploadErr);
      }

      await api.request(`/admin/users/${targetUserId}/photo`, {
        method: 'PATCH',
        body: JSON.stringify({ profile_photo: photoUrl })
      });

      setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, profile_photo: photoUrl } : u));
      if (user && user.id === targetUserId) {
        updateUser({ profile_photo: photoUrl });
      }

      tactileFeedback('success');
      gToast.success(language === 'am' ? 'የሰራተኛው የመገለጫ ፎቶ ተቀይሯል!' : 'Staff profile photo updated successfully!');
    } catch (err: any) {
      tactileFeedback('error');
      gToast.error(err.message || 'Failed to update staff photo');
    } finally {
      setUploadingStaffPhotoId(null);
      setEditingPhotoStaffId(null);
      if (staffPhotoFileInputRef.current) {
        staffPhotoFileInputRef.current.value = '';
      }
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
          timezone_offset_minutes: offsetMin,
          staff_history_visible: staffHistoryVisible ? 1 : 0,
          staff_history_roles: staffHistoryRoles
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
      gToast.success('Restaurant Branding & Settings updated successfully!');
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update branding settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStaffHistoryMaster = async (makeVisible: boolean) => {
    try {
      setIsUpdatingHistoryConfig(true);
      tactileFeedback('click');
      await api.request('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          staff_history_visible: makeVisible ? 1 : 0,
          staff_history_roles: staffHistoryRoles
        })
      });
      setStaffHistoryVisible(makeVisible);
      refreshSettings();
      gToast.success(
        makeVisible
          ? (language === 'am' ? 'የሰራተኞች የትዕዛዝ ታሪክ እንዲታይ ተደርጓል' : 'Staff order history is now visible')
          : (language === 'am' ? 'የሰራተኞች የትዕዛዝ ታሪክ ተደብቋል' : 'Staff order history has been hidden from staff screens')
      );
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update staff history visibility');
    } finally {
      setIsUpdatingHistoryConfig(false);
    }
  };

  const handleToggleStaffRoleHistory = async (roleId: string) => {
    try {
      setIsUpdatingHistoryConfig(true);
      tactileFeedback('click');
      const updated = staffHistoryRoles.includes(roleId)
        ? staffHistoryRoles.filter(r => r !== roleId)
        : [...staffHistoryRoles, roleId];
      
      await api.request('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          staff_history_visible: staffHistoryVisible ? 1 : 0,
          staff_history_roles: updated
        })
      });
      setStaffHistoryRoles(updated);
      refreshSettings();
      gToast.success(
        updated.includes(roleId)
          ? (language === 'am' ? `ለ ${roleId} ታሪክ እንዲታይ ተፈቅዷል` : `History enabled for ${roleId}`)
          : (language === 'am' ? `ለ ${roleId} ታሪክ ተደብቋል` : `History hidden for ${roleId}`)
      );
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update role history setting');
    } finally {
      setIsUpdatingHistoryConfig(false);
    }
  };

  const handleCleanDemoData = async () => {
    if (user?.role !== 'superadmin') {
      gToast.error(language === 'am' ? 'ይህንን እርምጃ ሱፐር አድሚን ብቻ ነው ማከናወን የሚችለው' : 'Access denied. Only Super Admin can perform clean slate wipes.');
      return;
    }
    if (cleanConfirmText !== 'CLEAN' && cleanConfirmText !== 'አጥፋ') {
      gToast.error(language === 'am' ? 'እባክዎ ለማረጋገጥ CLEAN ወይም አጥፋ ብለው ይጻፉ' : 'Please type CLEAN to confirm');
      return;
    }
    try {
      setIsCleaningDemo(true);
      tactileFeedback('warning');
      await api.request('/admin/clean-demo-data', {
        method: 'POST',
        body: JSON.stringify({})
      });
      gToast.success(language === 'am' ? 'የሙከራ መረጃዎች (ምግቦች፣ ጠረጴዛዎች፣ ኬኮች፣ ስቶክ) በሙሉ ተሰርዘዋል!' : 'All demo items and catalog wiped successfully!');
      setShowCleanModal(false);
      setCleanConfirmText('');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to wipe demo data');
    } finally {
      setIsCleaningDemo(false);
    }
  };

  const handleSeedOfficialMenu = async () => {
    const confirmMsg = language === 'am'
      ? 'ኦፊሴላዊውን የምግብ ዝርዝር (11 ምድቦች እና 96 ምግቦች ከፎቶዎቻቸው ጋር) ወደ ነበረበት መመለስ ይፈልጋሉ?'
      : 'Do you want to restore/sync the official menu catalogue (11 categories and 96 items with photos)?';
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsSeedingMenu(true);
      tactileFeedback('click');
      await api.request('/admin/seed-official-menu', { method: 'POST' });
      gToast.success(language === 'am' ? 'ኦፊሴላዊው የምግብ ዝርዝር በተሳካ ሁኔታ ተጭኗል!' : 'Official menu successfully restored!');
      await loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to restore official menu');
    } finally {
      setIsSeedingMenu(false);
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

  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmMsg = language === 'am'
      ? `እርግጠኛ ነዎት "${userName}" የተባለውን ሠራተኛ መሰረዝ ይፈልጋሉ? ይህ እርምጃ ሊመለስ አይችልም።`
      : `Are you sure you want to permanently delete staff member "${userName}"? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      tactileFeedback('warning');
      await api.request(`/admin/users/${userId}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== userId));
      gToast.success(language === 'am' ? `ሠራተኛ "${userName}" በተሳካ ሁኔታ ተሰርዟል` : `Staff member "${userName}" deleted successfully`);
    } catch (err: any) {
      gToast.error(err.message || 'Failed to delete user');
    }
  };

  const handleWipeSales = async () => {
    if (user?.role !== 'superadmin') {
      gToast.error(language === 'am' ? 'ይህንን እርምጃ ሱፐር አድሚን ብቻ ነው ማከናወን የሚችለው' : 'Access denied. Only Super Admin can perform clean slate wipes.');
      return;
    }
    const confirmMsg = language === 'am'
      ? 'ማስጠንቀቂያ! የሽያጭ ታሪክ፣ የትዕዛዞች፣ የደረሰኞች እና የክፍያ መረጃዎችን በሙሉ መሰረዝ ይፈልጋሉ? ይህ እርምጃ ሊመለስ አይችልም።'
      : 'WARNING! Permanently wipe all sales history, orders, payments, and receipts? This action cannot be undone.';
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      tactileFeedback('warning');
      await api.request('/admin/wipe-sales', { method: 'POST' });
      gToast.success(language === 'am' ? 'የሽያጭ ታሪክ በሙሉ ተሰርዟል!' : 'All sales history wiped successfully!');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to wipe sales history');
    } finally {
      setLoading(false);
    }
  };

  const handleWipeExpenses = async () => {
    if (user?.role !== 'superadmin') {
      gToast.error(language === 'am' ? 'ይህንን እርምጃ ሱፐር አድሚን ብቻ ነው ማከናወን የሚችለው' : 'Access denied. Only Super Admin can perform clean slate wipes.');
      return;
    }
    const confirmMsg = language === 'am'
      ? 'ማስጠንቀቂያ! የወጪ እና የግዢ መረጃዎችን በሙሉ መሰረዝ ይፈልጋሉ? ይህ እርምጃ ሊመለስ አይችልም።'
      : 'WARNING! Permanently wipe all operational expenses, purchases, and waste records? This action cannot be undone.';
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      tactileFeedback('warning');
      await api.request('/admin/wipe-expenses', { method: 'POST' });
      setExpenses([]);
      gToast.success(language === 'am' ? 'የወጪ መረጃዎች በሙሉ ተሰርዘዋል!' : 'All expenses wiped successfully!');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to wipe expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      tactileFeedback('click');
      await api.request(`/expenses/${expenseId}`, { method: 'DELETE' });
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      gToast.success(language === 'am' ? 'ወጪ ተሰርዟል' : 'Expense deleted');
    } catch (err: any) {
      gToast.error(err.message || 'Failed to delete expense');
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
      {/* Top Admin Action Bar: AI Business Intelligence Copilot */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={() => {
            tactileFeedback('click');
            setShowAiModal(true);
          }}
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 12,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
            transition: 'all 0.2s ease'
          }}
        >
          <Sparkles size={16} color="#fef08a" />
          <span>{language === 'am' ? '✨ የስራ አስኪያጅ AI አማካሪ (AI Copilot)' : '✨ AI Business Copilot'}</span>
        </button>

        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
          {language === 'am' ? 'የቀጥታ ሽያጭ፣ የኩሽና እና የጥሬ ዕቃ ትንተና' : 'Live analytics, inventory risks & executive advice'}
        </span>
      </div>

      {/* Tab Navigation */}
      <div className="no-scrollbar" style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 10, padding: 4, marginBottom: 16, overflowX: 'auto', flexWrap: 'wrap' }}>
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
        <button
          onClick={() => setActiveTab('feedback')}
          style={{ flex: 1, minWidth: 78, padding: '8px 4px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: activeTab === 'feedback' ? '#ffffff' : 'transparent', color: activeTab === 'feedback' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
        >
          <span>⭐</span>
          <span>{language === 'am' ? 'አስተያየት' : 'Feedback'}</span>
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
                setEditingStaffId(null);
                setStaffName('');
                setStaffUsername('');
                setStaffPassword('password123');
                setStaffRole('waiter');
                setStaffBranch(currentBranchId === 'ALL' ? branches[0]?.id : currentBranchId);
                setStaffPhone('');
                setStaffEmpId('');
                setStaffPhoto('');
                setShowStaffModal(true);
              }}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              <Plus size={14} /> {language === 'am' ? 'አዲስ ሠራተኛ መዝግብ' : 'Add New Staff'}
            </button>
          </div>

          {/* Hidden Staff Photo File Input */}
          <input
            ref={staffPhotoFileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleStaffPhotoFileChange}
            style={{ display: 'none' }}
          />

          {/* Pending Approvals */}
          {pendingUsers.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Pending Registration Approvals ({pendingUsers.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingUsers.map(u => (
                  <div key={u.id} style={{ background: '#fffbeb', border: '1.5px solid #fef3c7', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          background: 'var(--primary-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--primary)',
                          fontWeight: 900,
                          fontSize: 15,
                          flexShrink: 0
                        }}
                      >
                        {u.profile_photo ? (
                          <img src={resolveImageUrl(u.profile_photo)} alt={u.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          (u.full_name || u.username).charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <strong style={{ fontSize: 13 }}>{u.full_name}</strong>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                          Role: {u.role.toUpperCase()} • Branch: {u.branch_name || u.branch_id}
                        </span>
                      </div>
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
              <div key={u.id} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Staff Avatar with quick change trigger */}
                  <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: 'var(--primary-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        fontWeight: 900,
                        fontSize: 16,
                        border: '1.5px solid var(--primary)'
                      }}
                    >
                      {u.profile_photo ? (
                        <img src={resolveImageUrl(u.profile_photo)} alt={u.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        (u.full_name || u.username).charAt(0).toUpperCase()
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={uploadingStaffPhotoId === u.id}
                      onClick={() => handleTriggerStaffPhotoUpload(u.id)}
                      title={language === 'am' ? 'የሰራተኛ ፎቶ ቀይር / ጫን' : 'Upload / Change staff photo'}
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        color: '#ffffff',
                        border: '2px solid #ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      {uploadingStaffPhotoId === u.id ? <RefreshCw size={10} className="animate-spin" /> : <Camera size={10} />}
                    </button>
                  </div>

                  <div>
                    <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>{u.full_name}</strong>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                      @{u.username} • {u.role === 'superadmin' ? (
                        <span style={{
                          background: 'linear-gradient(135deg, #7c3aed 0%, #d97706 100%)',
                          color: '#ffffff',
                          padding: '2px 7px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 900,
                          letterSpacing: 0.5,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }}>
                          ⚡ SUPER ADMIN
                        </span>
                      ) : (
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{u.role.toUpperCase()}</span>
                      )} • {u.branch_name || u.branch_id}
                    </span>
                  </div>
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
                  {/* Edit Staff Button */}
                  {(user?.role === 'superadmin' || (u.role !== 'owner' && u.role !== 'superadmin') || u.id === user?.id) && (
                    <button
                      onClick={() => openEditStaffModal(u)}
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer'
                      }}
                      title={language === 'am' ? 'የሠራተኛ መረጃ አሻሽል' : 'Edit Staff Details'}
                    >
                      <Edit2 size={11} color="#2563eb" />
                      {language === 'am' ? 'አስተካክል' : 'Edit'}
                    </button>
                  )}
                  {/* Actions: superadmin can manage anyone except self; admin/owner cannot manage superadmin or owner */}
                  {u.id !== user?.id && (user?.role === 'superadmin' || (u.role !== 'owner' && u.role !== 'superadmin')) && (
                    <>
                      <button
                        onClick={() => handleUserStatus(u.id, u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: u.status === 'ACTIVE' ? 'var(--danger)' : 'var(--accent)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px 6px'
                        }}
                      >
                        {u.status === 'ACTIVE' ? (language === 'am' ? 'አግድ' : 'Suspend') : (language === 'am' ? 'አንቃ' : 'Activate')}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.full_name || u.username)}
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#dc2626',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer'
                        }}
                        title={language === 'am' ? 'ሠራተኛን ሰርዝ' : 'Delete Staff'}
                      >
                        <Trash2 size={12} color="#dc2626" />
                        {language === 'am' ? 'አጥፋ' : 'Delete'}
                      </button>
                    </>
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
      {activeTab === 'tables' && (() => {
        const OFFICIAL_SECTION_ORDER = [
          'Restaurant 1',
          'TERAZ (Terrace)',
          'Restaurant-02',
          'Restaurant Coffee Area',
          'Garden - Left Side',
          'Berenda (Veranda)'
        ];
        const tableSections = Array.from(new Set(tables.map(t => t.section || 'General').filter(Boolean)))
          .sort((a, b) => {
            const idxA = OFFICIAL_SECTION_ORDER.indexOf(a);
            const idxB = OFFICIAL_SECTION_ORDER.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
          });
        const displayedTables = selectedAdminSectionFilter === 'ALL'
          ? tables
          : tables.filter(t => (t.section || 'General') === selectedAdminSectionFilter);

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>
                  {language === 'am' ? 'ጠረጴዛዎች እና ክፍሎች' : 'Tables & Restaurant Sections'} ({tables.length} tables)
                </span>
                {tableSections.length > 1 && (
                  <select
                    value={selectedAdminSectionFilter}
                    onChange={(e) => setSelectedAdminSectionFilter(e.target.value)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      height: 32
                    }}
                  >
                    <option value="ALL">
                      {language === 'am' ? '✨ ሁሉም ክፍሎች' : '✨ All Sections'} ({tables.length})
                    </option>
                    {tableSections.map(sec => (
                      <option key={sec} value={sec}>
                        {sec} ({tables.filter(t => (t.section || 'General') === sec).length})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={handleSeedOfficialTables}
                  disabled={isSeedingTables}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                  title={language === 'am' ? 'ሁሉንም 6 ክፍሎች እና 51 ኦፊሴላዊ ጠረጴዛዎችን ጫን' : 'Restore all 6 official sections and 51 tables'}
                >
                  <Sparkles size={14} color="#f59e0b" /> {isSeedingTables ? (language === 'am' ? 'በመጫን ላይ...' : 'Seeding...') : (language === 'am' ? 'ኦፊሴላዊ ጠረጴዛዎችን ጫን (51)' : 'Restore Official Tables (51)')}
                </button>
                <button
                  onClick={() => {
                    setEditingTableId(null);
                    setTableNumber('');
                    setTableName('');
                    setTableSection('Restaurant 1');
                    setCustomSection('');
                    setTableCapacity(4);
                    setTableBranch(currentBranchId === 'ALL' ? branches[0]?.id : currentBranchId);
                    setShowTableModal(true);
                  }}
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800 }}
                >
                  <Plus size={14} /> {language === 'am' ? 'ጠረጴዛ ጨምር' : 'Add Table / Section'}
                </button>
              </div>
            </div>

            {/* Section Filter Pills - Clean wrapping without scrollbar on PC */}
            <div
              className="no-scrollbar"
              onWheel={(e) => {
                if (e.deltaY !== 0 && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
                  e.currentTarget.scrollLeft += e.deltaY;
                }
              }}
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                alignItems: 'center',
                marginBottom: 14
              }}
            >
              <button
                onClick={() => setSelectedAdminSectionFilter('ALL')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 800,
                  border: selectedAdminSectionFilter === 'ALL' ? 'none' : '1px solid var(--border)',
                  background: selectedAdminSectionFilter === 'ALL' ? 'var(--primary)' : 'var(--bg-card)',
                  color: selectedAdminSectionFilter === 'ALL' ? '#ffffff' : 'var(--text-main)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {language === 'am' ? 'ሁሉም ክፍሎች' : 'All Sections'} ({tables.length})
              </button>
              {tableSections.map(sec => {
                const count = tables.filter(t => (t.section || 'General') === sec).length;
                const isSelected = selectedAdminSectionFilter === sec;
                return (
                  <button
                    key={sec}
                    onClick={() => setSelectedAdminSectionFilter(sec)}
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
                    <span>📍</span>
                    <span>{sec}</span>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {displayedTables.map(tbl => (
                <div key={tbl.id} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary)' }}>
                        {tbl.table_number}
                      </span>
                      <span className={`badge badge-${tbl.status === 'AVAILABLE' ? 'ready' : tbl.status === 'OCCUPIED' ? 'cancelled' : 'pending'}`}>
                        {tbl.status === 'AVAILABLE' ? (language === 'am' ? 'ነፃ' : 'AVAILABLE') : tbl.status === 'OCCUPIED' ? (language === 'am' ? 'የተያዘ' : 'OCCUPIED') : tbl.status}
                      </span>
                    </div>
                    <h5 style={{ fontSize: 13, fontWeight: 700, margin: '2px 0' }}>{tbl.name}</h5>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                      📍 Section: <strong style={{ color: 'var(--text-main)' }}>{tbl.section}</strong>
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Capacity: {tbl.capacity} Guests
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                    <button onClick={() => openEditTable(tbl)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>
                      <Edit2 size={13} /> {language === 'am' ? 'አስተካክል' : 'Edit'}
                    </button>
                    <button onClick={() => handleDeleteTable(tbl.id, tbl.table_number)} className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 11 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 4. BRANDING & APP NAME SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

        {/* Staff Order History Privacy & Visibility Control Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid var(--border)',
            borderRadius: 18,
            padding: 22,
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: staffHistoryVisible ? 'rgba(99, 102, 241, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: staffHistoryVisible ? '#4f46e5' : '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {staffHistoryVisible ? <Eye size={24} /> : <EyeOff size={24} />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                    {language === 'am' ? 'የሰራተኞች የትዕዛዝ ታሪክ ማሳያ መቆጣጠሪያ' : 'Staff Order History Privacy & Visibility'}
                  </h3>
                  <span
                    style={{
                      background: '#ede9fe',
                      color: '#6d28d9',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6
                    }}
                  >
                    {language === 'am' ? 'አድሚን፣ ሱፐር አድሚን እና ባለቤት' : 'ADMIN, SUPER ADMIN & OWNER'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                  {language === 'am'
                    ? 'ለአስተናጋጅ፣ ሂሳብ ተቀባይ፣ ማብሰያ፣ ባሪስታ እና ኬክ ካውንተር የትዕዛዝ ታሪክ ማሳያ ወይም መደበቂያ። (አድሚን፣ ሱፐር አድሚን እና ባለቤት ሁልጊዜ ሙሉ ታሪክ ማየት ይችላሉ)'
                    : 'Control whether staff roles can access historical order tickets and settlement records. Admin, Super Admin, and Owner always retain full unrestricted access.'}
                </p>
              </div>
            </div>

            {/* Master Toggle Button */}
            <button
              type="button"
              disabled={isUpdatingHistoryConfig}
              onClick={() => handleToggleStaffHistoryMaster(!staffHistoryVisible)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 900,
                border: 'none',
                cursor: isUpdatingHistoryConfig ? 'not-allowed' : 'pointer',
                background: staffHistoryVisible
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff',
                boxShadow: staffHistoryVisible
                  ? '0 4px 14px rgba(16, 185, 129, 0.3)'
                  : '0 4px 14px rgba(239, 68, 68, 0.3)',
                transition: 'all 0.15s ease'
              }}
            >
              {staffHistoryVisible ? <Eye size={16} /> : <EyeOff size={16} />}
              <span>
                {staffHistoryVisible
                  ? (language === 'am' ? 'ታሪክ ይታያል (Visible) • ደብቅ' : 'History is Visible • Click to Hide')
                  : (language === 'am' ? 'ታሪክ ተደብቋል (Hidden) • አሳይ' : 'History is Hidden • Click to Show')}
              </span>
            </button>
          </div>

          {/* Granular Per-Role Switches */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {language === 'am' ? 'በየሙያ ዘርፉ የተለየ መቆጣጠሪያ (Per-Role Granular Visibility):' : 'Granular Role History Switches:'}
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
              {ALL_STAFF_ROLES.map(role => {
                const isRoleAllowed = staffHistoryVisible && staffHistoryRoles.includes(role.id);
                return (
                  <div
                    key={role.id}
                    onClick={() => {
                      if (!isUpdatingHistoryConfig) {
                        handleToggleStaffRoleHistory(role.id);
                      }
                    }}
                    style={{
                      background: isRoleAllowed ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-subtle, #f8fafc)',
                      border: isRoleAllowed ? '1.5px solid #6366f1' : '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: isUpdatingHistoryConfig ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{role.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isRoleAllowed ? '#312e81' : 'var(--text-muted)' }}>
                        {role.label}
                      </span>
                    </div>

                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 900,
                        background: isRoleAllowed ? '#10b981' : '#94a3b8',
                        color: '#ffffff'
                      }}
                    >
                      {isRoleAllowed ? (language === 'am' ? 'የሚታይ' : 'ON') : (language === 'am' ? 'የተደበቀ' : 'OFF')}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(99, 102, 241, 0.06)',
                border: '1px dashed rgba(99, 102, 241, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                color: '#4338ca'
              }}
            >
              <ShieldCheck size={16} style={{ flexShrink: 0 }} />
              <span>
                {language === 'am'
                  ? '🔒 ማረጋገጫ: ታሪክ ሲደበቅ ከስክሪናቸው ሙሉ በሙሉ ከመጥፋቱ በተጨማሪ ከዳታቤዝም መረጃው እንዳይደርሳቸው በጀርባ ሰርቨር የተጠበቀ ነው (Super Admin, Admin & Owner ሁልጊዜ ሙሉ ታሪክ ማየት ይችላሉ)።'
                  : '🔒 Security Enforced: When history is hidden, both the UI tabs and backend server APIs block staff access, ensuring complete privacy. Admin, Super Admin, and Owner always have full visibility.'}
              </span>
            </div>
          </div>
        </div>

        {/* Client Handover / Wipe Demo Catalog Section (SUPER ADMIN ONLY) */}
        {user?.role === 'superadmin' && (
          <div style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #fef8f8 100%)',
            border: '2px solid #ef4444',
            borderRadius: 18,
            padding: 24,
            boxShadow: '0 8px 30px rgba(239, 68, 68, 0.08)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Super Admin Master Authority Ribbon */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 20,
              background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 50%, #ea580c 100%)',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: 16,
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)'
            }}>
              <Sparkles size={13} color="#fef08a" />
              <span>Super Admin Exclusive Master Control</span>
            </div>

            {/* Live Telemetry / System Health Mini Cards */}
            {superAdminStats && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                gap: 10,
                marginBottom: 20
              }}>
                <div style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {language === 'am' ? 'ሰራተኞች' : 'Active Staff'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#1e293b', marginTop: 2 }}>
                    {superAdminStats.users}
                  </div>
                </div>

                <div style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {language === 'am' ? 'ጠቅላላ ትዕዛዞች' : 'Total Orders'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#0284c7', marginTop: 2 }}>
                    {superAdminStats.orders}
                  </div>
                </div>

                <div style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {language === 'am' ? 'የምግብ ዝርዝር' : 'Menu Items'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#16a34a', marginTop: 2 }}>
                    {superAdminStats.menuItems}
                  </div>
                </div>

                <div style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {language === 'am' ? 'ስቶክ / ግብዓቶች' : 'Stock Items'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#d97706', marginTop: 2 }}>
                    {superAdminStats.ingredients}
                  </div>
                </div>

                <div style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {language === 'am' ? 'የዳታቤዝ መጠን' : 'DB Size'}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#475569', marginTop: 4 }}>
                    {superAdminStats.dbSizeBytes ? (superAdminStats.dbSizeBytes / 1024).toFixed(1) + ' KB' : 'Active'}
                  </div>
                </div>

                <div style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  padding: '8px 10px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <button
                    type="button"
                    onClick={handleOptimizeDatabase}
                    disabled={isOptimizingDb}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      background: '#f8fafc',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      color: '#334155',
                      fontSize: 10,
                      fontWeight: 800
                    }}
                    title="VACUUM, optimize and flush SQLite tables"
                  >
                    <RefreshCw size={13} className={isOptimizingDb ? 'animate-spin' : ''} color="#6366f1" />
                    <span>{isOptimizingDb ? 'Optimizing...' : (language === 'am' ? 'ዳታቤዝ አጽዳ/VACUUM' : 'Optimize DB')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Client Handover / Wipe Demo Catalog Section */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #fecaca',
              borderRadius: 14,
              padding: 18,
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: '#fef2f2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Trash2 size={22} color="#dc2626" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 800, color: '#991b1b', margin: 0 }}>
                        {language === 'am' ? 'የደንበኛ ርክክብ / የሙከራ መረጃዎችን ማጽጃ' : 'Client Handover / Clean Slate Mode'}
                      </h4>
                      <span style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4
                      }}>
                        SUPER ADMIN ONLY
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0 0', lineHeight: 1.4 }}>
                      {language === 'am'
                        ? 'የሙከራ ምግቦችን፣ ጠረጴዛዎችን፣ ኬኮችን፣ ስቶክ እና የሽያጭ ታሪክን ያጸዳል (የሰራተኞች መግቢያ፣ ቅርንጫፎች እና ላይሰንስ ሳይነኩ ይቀጥላሉ)'
                        : 'Wipes all sample menu items, tables, cakes, stock, and orders for production delivery. Preserves staff accounts, branches, and licensing.'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleWipeSales}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: '#f97316',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: 12,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 4px rgba(249, 115, 22, 0.2)'
                    }}
                  >
                    <Trash2 size={14} />
                    {language === 'am' ? 'የሽያጭ ታሪክ አጽዳ' : 'Wipe Sales History'}
                  </button>

                  <button
                    type="button"
                    onClick={handleWipeExpenses}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: '#ea580c',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: 12,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 4px rgba(234, 88, 12, 0.2)'
                    }}
                  >
                    <Trash2 size={14} />
                    {language === 'am' ? 'የወጪ መረጃዎችን አጽዳ' : 'Wipe Expenses History'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCleanConfirmText('');
                      setShowCleanModal(true);
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: '#dc2626',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: 12,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
                    }}
                  >
                    <Trash2 size={14} />
                    {language === 'am' ? 'የሙከራ ካታሎግ አጽዳ' : 'Wipe Demo Items & Catalog'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>
              {language === 'am' ? 'የተመዘገቡ ወጪዎች' : 'Operational Expenses'} ({expenses.length})
            </span>
            {expenses.length > 0 && (
              <button
                type="button"
                onClick={handleWipeExpenses}
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#dc2626',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={13} color="#dc2626" />
                {language === 'am' ? 'ሁሉንም ወጪዎች አጥፋ' : 'Wipe All Expenses'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {expenses.map(e => (
              <div key={e.id} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 13 }}>{e.category}</strong>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{e.description} • {e.expense_date}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--danger)' }}>
                    -{e.amount} {t('currency')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteExpense(e.id)}
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 6,
                      padding: 5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="Delete Expense"
                  >
                    <Trash2 size={13} color="#dc2626" />
                  </button>
                </div>
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
          {/* Top Title & Quick Actions Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>
                {language === 'am' ? 'የምግብ ካታሎግ' : 'Menu Catalogue'}
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                background: 'var(--primary-light, rgba(255,158,1,0.15))',
                color: 'var(--primary)',
                padding: '2px 8px',
                borderRadius: 10
              }}>
                {menuItems.length} {language === 'am' ? 'ምግቦች' : 'items'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={handleSeedOfficialMenu}
                disabled={isSeedingMenu}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
                title={language === 'am' ? 'ሁሉንም 11 ምድቦች እና 96 ምግቦች ጫን' : 'Restore all 11 official categories & 96 items'}
              >
                <Sparkles size={13} color="#f59e0b" />
                <span>{isSeedingMenu ? (language === 'am' ? 'በመጫን ላይ...' : 'Seeding...') : (language === 'am' ? 'ኦፊሴላዊ ምናሌ ጫን' : 'Restore Menu')}</span>
              </button>
              <button
                onClick={() => setShowCategoryManagerModal(true)}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
                title={language === 'am' ? 'ሁሉንም ምድቦች አስተዳድር፣ አስተካክል ወይም ሰርዝ' : 'Manage, edit or delete all menu categories'}
              >
                <Tag size={13} color="var(--primary)" />
                <span>{language === 'am' ? 'ምድቦች' : 'Categories'}</span>
              </button>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setShowCategoryModal(true);
                }}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
              >
                <FolderPlus size={13} color="var(--primary)" />
                <span>{language === 'am' ? '+ አዲስ ምድብ' : '+ Category'}</span>
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
                style={{ padding: '6px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800 }}
              >
                <Plus size={14} />
                <span>{language === 'am' ? 'ምግብ ጨምር' : 'Add Item'}</span>
              </button>
            </div>
          </div>

          {/* Quick Search & Filter Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            flexWrap: 'wrap'
          }}>
            {/* Search Input */}
            <div style={{ flex: '1 1 200px', position: 'relative' }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: 10 }} />
              <input
                type="text"
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
                placeholder={language === 'am' ? 'ምግብ በስም ወይም በማብራሪያ ፈልግ...' : 'Search dish by name, Amharic, or ingredient...'}
                style={{
                  width: '100%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '7px 30px 7px 30px',
                  fontSize: 12,
                  color: 'var(--text-main)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {menuSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMenuSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Category Jump Dropdown for fast navigation */}
            <div style={{ flex: '0 0 auto' }}>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '7px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">
                  🍽️ {language === 'am' ? 'ሁሉም ምድቦች' : 'All Categories'} ({menuItems.length})
                </option>
                {categories.map(c => {
                  const cnt = menuItems.filter(m => m.category_id === c.id).length;
                  const cName = language === 'am' && c.name_amharic ? c.name_amharic : c.name;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.icon || '🍽️'} {cName} ({cnt})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Smart Horizontal Category Carousel (Single Row Slider) */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            {/* Left Scroll Arrow Button */}
            <button
              type="button"
              onClick={() => scrollCategories('left')}
              title="Scroll left"
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 2,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-main)'
              }}
            >
              <ChevronLeft size={16} />
            </button>

            {/* Horizontal Track */}
            <div
              ref={categoryScrollRef}
              className="no-scrollbar"
              onWheel={(e) => {
                if (e.deltaY !== 0 && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
                  e.currentTarget.scrollLeft += e.deltaY;
                }
              }}
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                flexWrap: 'nowrap',
                alignItems: 'center',
                padding: '4px 34px',
                scrollBehavior: 'smooth'
              }}
            >
              {/* All Items Pill */}
              <button
                onClick={() => setSelectedCategoryFilter('ALL')}
                style={{
                  padding: '7px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: selectedCategoryFilter === 'ALL' ? 800 : 700,
                  border: selectedCategoryFilter === 'ALL' ? 'none' : '1px solid var(--border)',
                  background: selectedCategoryFilter === 'ALL'
                    ? 'linear-gradient(135deg, var(--primary) 0%, #ea8c00 100%)'
                    : 'var(--bg-card)',
                  color: selectedCategoryFilter === 'ALL' ? '#ffffff' : 'var(--text-main)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: selectedCategoryFilter === 'ALL' ? '0 3px 10px rgba(255, 158, 1, 0.35)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                🍽️ {language === 'am' ? 'ሁሉም ምግቦች' : 'All Items'} ({menuItems.length})
              </button>

              {/* Individual Category Pills */}
              {categories.map(cat => {
                const count = menuItems.filter(m => m.category_id === cat.id).length;
                const isSelected = selectedCategoryFilter === cat.id;
                const catTitle = language === 'am' && cat.name_amharic ? cat.name_amharic : cat.name;

                return (
                  <div
                    key={cat.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: 20,
                      border: isSelected ? 'none' : '1px solid var(--border)',
                      background: isSelected
                        ? 'linear-gradient(135deg, var(--primary) 0%, #ea8c00 100%)'
                        : 'var(--bg-card)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      boxShadow: isSelected ? '0 3px 10px rgba(255, 158, 1, 0.35)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <button
                      onClick={() => setSelectedCategoryFilter(cat.id)}
                      style={{
                        padding: '7px 8px 7px 12px',
                        fontSize: 12,
                        fontWeight: isSelected ? 800 : 700,
                        background: 'transparent',
                        color: isSelected ? '#ffffff' : 'var(--text-main)',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <span>{cat.icon || '🍽️'}</span>
                      <span>{catTitle}</span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-subtle)',
                        color: isSelected ? '#ffffff' : 'var(--text-muted)'
                      }}>
                        {count}
                      </span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCategory(cat);
                        setShowCategoryModal(true);
                      }}
                      title={language === 'am' ? `"${catTitle}" ምድብ አስተካክል / ሰርዝ` : `Edit / Delete "${cat.name}" category`}
                      style={{
                        padding: '7px 8px 7px 2px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: isSelected ? '#ffffff' : 'var(--text-muted)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isSelected ? 0.95 : 0.7
                      }}
                    >
                      <Edit2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Right Scroll Arrow Button */}
            <button
              type="button"
              onClick={() => scrollCategories('right')}
              title="Scroll right"
              style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 2,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-main)'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Menu Items List */}
          {(() => {
            const filteredItems = menuItems.filter(item => {
              const matchesCategory = selectedCategoryFilter === 'ALL' || item.category_id === selectedCategoryFilter;
              if (!matchesCategory) return false;
              if (!menuSearchQuery.trim()) return true;
              const q = menuSearchQuery.toLowerCase().trim();
              return (
                (item.name && item.name.toLowerCase().includes(q)) ||
                (item.name_amharic && item.name_amharic.toLowerCase().includes(q)) ||
                (item.description && item.description.toLowerCase().includes(q))
              );
            });

            if (filteredItems.length === 0) {
              return (
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px dashed var(--border)',
                  borderRadius: 16,
                  padding: '36px 20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  marginTop: 10
                }}>
                  <Utensils size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                  <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-main)' }}>
                    {language === 'am' ? 'ምንም ምግብ አልተገኘም' : 'No menu items found'}
                  </p>
                  <p style={{ fontSize: 12, margin: 0 }}>
                    {menuSearchQuery
                      ? (language === 'am' ? `ከ "${menuSearchQuery}" ጋር የሚዛመድ ምግብ የለም` : `No dishes match "${menuSearchQuery}" in this category`)
                      : (language === 'am' ? 'በዚህ ምድብ ውስጥ የተመዘገበ ምግብ የለም' : 'No items registered in this category yet')}
                  </p>
                  {menuSearchQuery && (
                    <button
                      onClick={() => setMenuSearchQuery('')}
                      className="btn btn-secondary"
                      style={{ marginTop: 12, padding: '4px 12px', fontSize: 11 }}
                    >
                      {language === 'am' ? 'ፍለጋውን አጽዳ' : 'Clear Search'}
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                {filteredItems.map(item => (
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
            );
          })()}
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
            <div className="no-scrollbar" style={{ display: 'flex', gap: 6, background: 'var(--bg-subtle)', padding: 4, borderRadius: 10, flexWrap: 'wrap' }}>
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

      {/* 9. CUSTOMER FEEDBACK & QR CODE REVIEWS TAB */}
      {activeTab === 'feedback' && (
        <div style={{ marginTop: 10 }}>
          <CustomerFeedbackDashboard />
        </div>
      )}

      {/* MODAL: ADD STAFF */}
      {showStaffModal && (
        <ModalPortal>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box', zIndex: 100000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: 'min(92vh, calc(100dvh - 24px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-floating, 0 20px 40px rgba(0,0,0,0.3))' }} className="animate-fade-in">
            {/* Pinned Sticky Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    {editingStaffId 
                      ? (language === 'am' ? 'የሠራተኛ መረጃ አሻሽል' : 'Edit Staff Member') 
                      : (language === 'am' ? 'አዲስ ሠራተኛ መዝግብ' : 'Create New Staff Member')}
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {editingStaffId
                      ? (language === 'am' ? 'የሠራተኛውን ስም፣ ሚና፣ ቅርንጫፍና መረጃ ያሻሽሉ' : 'Update staff details, role and branch')
                      : (language === 'am' ? 'የሠራተኛውን ሚና፣ ቅርንጫፍና መረጃ ያስገቡ' : 'Assign role, branch and account info')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'var(--bg-subtle, #f1f5f9)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  padding: 0
                }}
                title={language === 'am' ? 'ዝጋ' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, margin: 0 }}>
              {/* Scrollable Form Body */}
              <div style={{ padding: '16px 18px', overflowY: 'auto', overflowX: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', gap: 12, width: '100%', boxSizing: 'border-box' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Full Name</label>
                  <input type="text" required placeholder="e.g. Selamawit Desta" value={staffName} onChange={e => setStaffName(e.target.value)} style={{ width: '100%' }} />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Username</label>
                  <input type="text" required placeholder="e.g. selam.d" value={staffUsername} onChange={e => setStaffUsername(e.target.value)} style={{ width: '100%' }} />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {editingStaffId
                      ? (language === 'am' ? 'አዲስ የይለፍ ቃል (ለውጥ ካልተፈለገ ባዶ ይተዉት)' : 'New Password (Optional, leave blank to keep)')
                      : (language === 'am' ? 'የይለፍ ቃል' : 'Password')}
                  </label>
                  <input
                    type="password"
                    required={!editingStaffId}
                    placeholder={editingStaffId ? (language === 'am' ? 'ባዶ ይተዉት (ያለውን ለማቆየት)' : 'Leave empty to keep current password') : 'password123'}
                    value={staffPassword}
                    onChange={e => setStaffPassword(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Assigned Role</label>
                    <select value={staffRole} onChange={e => setStaffRole(e.target.value as any)} style={{ width: '100%' }}>
                      {user?.role === 'superadmin' && (
                        <option value="superadmin">⚡ Super Administrator</option>
                      )}
                      <option value="waiter">Waiter</option>
                      <option value="cashier">Cashier</option>
                      <option value="chef">Chef</option>
                      <option value="barista">Barista</option>
                      <option value="storekeeper">Storekeeper</option>
                      <option value="bakery">Bakery / Baker Chef</option>
                      <option value="front_counter">Front Cake Counter</option>
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

                <div>
                  <ImageUploadCompressor
                    value={staffPhoto}
                    onChange={setStaffPhoto}
                    label={language === 'am' ? 'የሰራተኛው የመገለጫ ፎቶ (ካሜራ ወይም ምስል)' : 'Staff Profile Photo (Camera or Upload)'}
                  />
                </div>
              </div>

              {/* Pinned Sticky Footer */}
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="btn btn-secondary"
                  style={{ height: 44, padding: '0 16px', fontWeight: 700 }}
                >
                  {language === 'am' ? 'ሰርዝ' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ flex: 1, height: 44, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      {language === 'am' ? 'በማስቀመጥ ላይ...' : 'Saving...'}
                    </>
                  ) : editingStaffId ? (
                    language === 'am' ? 'ለውጦችን መዝግብ' : 'Save Staff Changes'
                  ) : (
                    language === 'am' ? 'ሠራተኛ መዝግብና አንቃ' : 'Create & Activate Staff'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* MODAL: CREATE / EDIT BRANCH */}
      {showBranchModal && (
        <ModalPortal>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box', zIndex: 100000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 460, maxHeight: 'min(92vh, calc(100dvh - 24px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-floating, 0 20px 40px rgba(0,0,0,0.3))' }} className="animate-fade-in">
            {/* Pinned Sticky Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    {editingBranchId ? (language === 'am' ? 'ቅርንጫፍ አሻሽል' : 'Edit Restaurant Branch') : (language === 'am' ? 'አዲስ ቅርንጫፍ መዝግብ' : 'Add New Restaurant Branch')}
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {language === 'am' ? 'አድራሻ፣ ከተማና ታክስ ተመን' : 'Location, city & VAT rate'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBranchModal(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'var(--bg-subtle, #f1f5f9)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  padding: 0
                }}
                title={language === 'am' ? 'ዝጋ' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, margin: 0 }}>
              {/* Scrollable Form Body */}
              <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              </div>

              {/* Pinned Sticky Footer */}
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="btn btn-secondary"
                  style={{ height: 44, padding: '0 16px', fontWeight: 700 }}
                >
                  {language === 'am' ? 'ሰርዝ' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ flex: 1, height: 44, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      {language === 'am' ? 'በማስቀመጥ ላይ...' : 'Saving...'}
                    </>
                  ) : editingBranchId ? (
                    language === 'am' ? 'ለውጦችን መዝግብ' : 'Save Branch Changes'
                  ) : (
                    language === 'am' ? 'ቅርንጫፍ መዝግብ' : 'Create Branch'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* MODAL: CREATE / EDIT TABLE & SECTION */}
      {showTableModal && (
        <ModalPortal>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box', zIndex: 100000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 460, maxHeight: 'min(92vh, calc(100dvh - 24px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-floating, 0 20px 40px rgba(0,0,0,0.3))' }} className="animate-fade-in">
            {/* Pinned Sticky Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Utensils size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    {editingTableId ? (language === 'am' ? 'ጠረጴዛ አሻሽል' : 'Edit Table & Section') : (language === 'am' ? 'አዲስ ጠረጴዛ መዝግብ' : 'Create Table & Section')}
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {language === 'am' ? 'የጠረጴዛ ቁጥር፣ ክፍልና የመቀመጫ ብዛት' : 'Table code, seating capacity & section'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'var(--bg-subtle, #f1f5f9)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  padding: 0
                }}
                title={language === 'am' ? 'ዝጋ' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTable} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, margin: 0 }}>
              {/* Scrollable Form Body */}
              <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    <option value="Restaurant 1">Restaurant 1</option>
                    <option value="TERAZ (Terrace)">TERAZ (Terrace)</option>
                    <option value="Restaurant-02">Restaurant-02</option>
                    <option value="Restaurant Coffee Area">Restaurant Coffee Area</option>
                    <option value="Garden - Left Side">Garden - Left Side</option>
                    <option value="Berenda (Veranda)">Berenda (Veranda)</option>
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
              </div>

              {/* Pinned Sticky Footer */}
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowTableModal(false)}
                  className="btn btn-secondary"
                  style={{ height: 44, padding: '0 16px', fontWeight: 700 }}
                >
                  {language === 'am' ? 'ሰርዝ' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ flex: 1, height: 44, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      {language === 'am' ? 'በማስቀመጥ ላይ...' : 'Saving Table...'}
                    </>
                  ) : editingTableId ? (
                    language === 'am' ? 'ለውጦችን መዝግብ' : 'Save Table Changes'
                  ) : (
                    language === 'am' ? 'ጠረጴዛ መዝግብ' : 'Create Table & Section'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* MODAL: CREATE / EDIT MENU ITEM */}
      {showMenuModal && (
        <ModalPortal>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box', zIndex: 100000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: 'min(92vh, calc(100dvh - 24px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-floating, 0 20px 40px rgba(0,0,0,0.3))' }} className="animate-fade-in">
            {/* Pinned Sticky Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Utensils size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    {editingMenuItemId ? (language === 'am' ? 'የምግብ ዝርዝር አሻሽል' : 'Edit Menu Item') : (language === 'am' ? 'አዲስ ምግብ መዝግብ' : 'Add New Menu Item')}
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {language === 'am' ? 'የምግብ ዋጋና ዝርዝር መረጃዎችን ያስገቡ' : 'Dish pricing, station routing & photo'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMenuModal(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'var(--bg-subtle, #f1f5f9)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  padding: 0
                }}
                title={language === 'am' ? 'ዝጋ' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMenuItem} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, margin: 0 }}>
              {/* Scrollable Form Body */}
              <div style={{ padding: '16px 18px', overflowY: 'auto', overflowX: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', gap: 12, width: '100%', boxSizing: 'border-box' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? 'የምግብ ስም (በእንግሊዝኛ)' : 'Item Name (English)'}
                  </label>
                  <input type="text" required placeholder="e.g. Gourmet Double Beef Burger" value={menuName} onChange={e => setMenuName(e.target.value)} style={{ width: '100%' }} />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? 'የምግብ ስም (በአማርኛ - አማራጭ)' : 'Item Name (Amharic - Optional)'}
                  </label>
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
                        <Plus size={11} /> {language === 'am' ? 'አዲስ' : 'New'}
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
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      {language === 'am' ? 'ዋጋ (ብር)' : `Price (${t('currency')})`}
                    </label>
                    <input type="number" min="0" step="0.5" required value={menuPrice} onChange={e => setMenuPrice(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? 'ዝግጅት የሚደረግበት ክፍል' : 'Preparation Routing'}
                  </label>
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
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? 'ማብራሪያ' : 'Description'}
                  </label>
                  <textarea rows={2} placeholder="Ingredients, recipe notes, allergens..." value={menuDesc} onChange={e => setMenuDesc(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>

              {/* Pinned Sticky Footer */}
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowMenuModal(false)}
                  className="btn btn-secondary"
                  style={{ height: 44, padding: '0 16px', fontWeight: 700 }}
                >
                  {language === 'am' ? 'ሰርዝ' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ flex: 1, height: 44, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      {language === 'am' ? 'በማስቀመጥ ላይ...' : 'Saving Item...'}
                    </>
                  ) : editingMenuItemId ? (
                    language === 'am' ? 'ለውጦችን መዝግብ' : 'Save Changes'
                  ) : (
                    language === 'am' ? 'ምግቡን መዝግብ' : 'Create Menu Item'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* MODAL: APPROVE ACCOUNT / PASSWORD REQUEST */}
      {selectedReqForApproval && (
        <ModalPortal>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box', zIndex: 100000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 460, maxHeight: 'min(92vh, calc(100dvh - 24px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-floating, 0 20px 40px rgba(0,0,0,0.3))' }} className="animate-fade-in">
            {/* Pinned Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', flexShrink: 0 }}>
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    {language === 'am' ? 'ጥያቄውን አጽድቅና ለውጡን ተግብር' : 'Approve Request & Apply Changes'}
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {language === 'am' ? 'የመለያ ወይም የይለፍ ቃል ማስተካከያ' : 'Staff account or credential update'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReqForApproval(null)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'var(--bg-subtle, #f1f5f9)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  padding: 0
                }}
                title={language === 'am' ? 'ዝጋ' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                  {selectedReqForApproval.full_name || selectedReqForApproval.username}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  @{selectedReqForApproval.username} • Role: {selectedReqForApproval.role?.toUpperCase()}
                </div>
              </div>

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
            </div>

            {/* Pinned Sticky Footer */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setSelectedReqForApproval(null)}
                disabled={isProcessingAction}
                className="btn btn-secondary"
                style={{ flex: 1, height: 44, fontWeight: 700 }}
              >
                {language === 'am' ? 'ተመለስ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleApproveRequest}
                disabled={isProcessingAction}
                className="btn btn-success"
                style={{ flex: 2, height: 44, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <CheckCircle size={16} />
                {isProcessingAction 
                  ? (language === 'am' ? 'በማጽደቅ ላይ...' : 'Approving...') 
                  : (language === 'am' ? 'አረጋግጥና አጽድቅ' : 'Confirm & Apply')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* MODAL: REJECT ACCOUNT / PASSWORD REQUEST */}
      {selectedReqForRejection && (
        <ModalPortal>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box', zIndex: 100000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 460, maxHeight: 'min(92vh, calc(100dvh - 24px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-floating, 0 20px 40px rgba(0,0,0,0.3))' }} className="animate-fade-in">
            {/* Pinned Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}>
                  <UserX size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#dc2626' }}>
                    {language === 'am' ? 'ጥያቄውን ውድቅ አድርግ' : 'Reject Account Request'}
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {language === 'am' ? 'ውድቅ የተደረገበትን ምክንያት ያስገቡ' : 'Specify rejection reason'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReqForRejection(null)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'var(--bg-subtle, #f1f5f9)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  padding: 0
                }}
                title={language === 'am' ? 'ዝጋ' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                  {selectedReqForRejection.full_name || selectedReqForRejection.username}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  @{selectedReqForRejection.username} • Role: {selectedReqForRejection.role?.toUpperCase()}
                </div>
              </div>

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
            </div>

            {/* Pinned Sticky Footer */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setSelectedReqForRejection(null)}
                disabled={isProcessingAction}
                className="btn btn-secondary"
                style={{ flex: 1, height: 44, fontWeight: 700 }}
              >
                {language === 'am' ? 'ተመለስ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleRejectRequest}
                disabled={isProcessingAction}
                className="btn btn-danger"
                style={{ flex: 2, height: 44, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <XCircle size={16} />
                {isProcessingAction 
                  ? (language === 'am' ? 'በማስወገድ ላይ...' : 'Rejecting...') 
                  : (language === 'am' ? 'ውድቅ አድርግ' : 'Confirm Rejection')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* MODAL: DIRECT STAFF PASSWORD RESET */}
      {directResetTarget && (
        <ModalPortal>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box', zIndex: 100000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 460, maxHeight: 'min(92vh, calc(100dvh - 24px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-floating, 0 20px 40px rgba(0,0,0,0.3))' }} className="animate-fade-in">
            {/* Pinned Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', flexShrink: 0 }}>
                  <Key size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    {language === 'am' ? 'የሰራተኛ የይለፍ ቃል ቀጥታ መቀየሪያ' : 'Direct Staff Password Reset'}
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {language === 'am' ? 'አዲስ የይለፍ ቃል ያዘጋጁ' : 'Set new password & unlock account'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDirectResetTarget(null)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'var(--bg-subtle, #f1f5f9)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  padding: 0
                }}
                title={language === 'am' ? 'ዝጋ' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDirectPasswordReset} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, margin: 0 }}>
              {/* Scrollable Body */}
              <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                    {directResetTarget.full_name || directResetTarget.username}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    @{directResetTarget.username} • Role: {directResetTarget.role?.toUpperCase()}
                  </div>
                </div>

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
              </div>

              {/* Pinned Sticky Footer */}
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setDirectResetTarget(null)}
                  disabled={isDirectResetting}
                  className="btn btn-secondary"
                  style={{ flex: 1, height: 44, fontWeight: 700 }}
                >
                  {language === 'am' ? 'ተመለስ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isDirectResetting || directResetPassword.trim().length < 6}
                  className="btn btn-primary"
                  style={{ flex: 2, height: 44, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
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
        </ModalPortal>
      )}

      {/* MODAL: CREATE CATEGORY */}
      <CreateCategoryModal
        isOpen={showCategoryModal && !editingCategory}
        onClose={() => setShowCategoryModal(false)}
        onCategoryCreated={(newCat: any) => {
          setCategories(prev => {
            if (prev.some(c => c.id === newCat.id)) return prev;
            return [...prev, newCat];
          });
          setMenuCategory(newCat.id);
        }}
      />

      {/* MODAL: CLEAN DEMO DATA CONFIRMATION (CLIENT HANDOVER - SUPER ADMIN ONLY) */}
      {showCleanModal && user?.role === 'superadmin' && (
        <ModalPortal>
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: 16,
            boxSizing: 'border-box'
          }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            maxWidth: 480,
            width: '100%',
            padding: 24,
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid #fca5a5'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertTriangle size={24} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#991b1b', margin: 0 }}>
                  {language === 'am' ? 'የሙከራ መረጃዎችን ማጽጃ' : 'Wipe Demo Items & Catalog'}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {language === 'am' ? 'የደንበኛ ርክክብ ዝግጅት' : 'Client Handover Preparation'}
                </div>
              </div>
            </div>

            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
              fontSize: 12,
              color: '#991b1b',
              lineHeight: 1.5
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 700 }}>
                ⚠️ {language === 'am' ? 'የሚከተሉት መረጃዎች በሙሉ ይሰረዛሉ:' : 'The following will be completely wiped:'}
              </p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>{language === 'am' ? 'ሁሉም የሙከራ ምግቦች እና ካቴጎሪዎች' : 'All sample menu items & categories'}</li>
                <li>{language === 'am' ? 'ሁሉም የሙከራ ጠረጴዛዎች' : 'All sample dining tables'}</li>
                <li>{language === 'am' ? 'ሁሉም የሙከራ ኬኮች፣ ባቾች እና የዳቦ መጋገሪያ ምርቶች' : 'All sample cakes, bakery batches & variations'}</li>
                <li>{language === 'am' ? 'ሁሉም የስቶክ/ዕቃዎች እና የግብይት መረጃዎች' : 'All stock ingredients & inventory transactions'}</li>
                <li>{language === 'am' ? 'ሁሉም የሙከራ ትዕዛዞች፣ ክፍያዎች እና ሪፖርቶች' : 'All test orders, payments & sales history'}</li>
              </ul>
              <div style={{ marginTop: 8, fontWeight: 700, color: '#166534' }}>
                ✅ {language === 'am' ? 'የሰራተኞች አካውንት፣ ቅርንጫፎች እና ላይሰንስ ሳይነኩ ይቀጥላሉ!' : 'Staff logins, branches, and system license remain untouched!'}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                {language === 'am' ? 'ለማረጋገጥ "CLEAN" ወይም "አጥፋ" ብለው ይጻፉ:' : 'Type "CLEAN" to confirm wipe:'}
              </label>
              <input
                type="text"
                value={cleanConfirmText}
                onChange={e => setCleanConfirmText(e.target.value)}
                placeholder="CLEAN"
                style={{ width: '100%', fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setShowCleanModal(false);
                  setCleanConfirmText('');
                }}
                disabled={isCleaningDemo}
                className="btn btn-secondary"
                style={{ flex: 1, height: 42 }}
              >
                {language === 'am' ? 'ተመለስ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleCleanDemoData}
                disabled={isCleaningDemo || (cleanConfirmText !== 'CLEAN' && cleanConfirmText !== 'አጥፋ')}
                style={{
                  flex: 1.5,
                  height: 42,
                  borderRadius: 8,
                  background: (cleanConfirmText === 'CLEAN' || cleanConfirmText === 'አጥፋ') ? '#dc2626' : '#9ca3af',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 13,
                  border: 'none',
                  cursor: (cleanConfirmText === 'CLEAN' || cleanConfirmText === 'አጥፋ') ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Trash2 size={16} />
                {isCleaningDemo 
                  ? (language === 'am' ? 'በማጽዳት ላይ...' : 'Wiping Demo Items...') 
                  : (language === 'am' ? 'ሁሉንም አጽዳ' : 'Confirm Wipe')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Category Manager Modal */}
      {showCategoryManagerModal && (
        <ModalPortal>
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
            boxSizing: 'border-box',
            zIndex: 100000
          }}>
            <div
              className="animate-fade-in"
              style={{
                background: 'var(--bg-card)',
                borderRadius: 20,
                width: '100%',
                maxWidth: 620,
                maxHeight: 'min(90vh, calc(100dvh - 24px))',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-floating, 0 20px 40px rgba(0,0,0,0.3))',
                border: '1px solid var(--border)'
              }}
            >
              {/* Header */}
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-card)',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Tag size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                      {language === 'am' ? 'የምግብ ምድቦች አስተዳዳሪ' : 'Menu Categories Manager'}
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {language === 'am' ? `${categories.length} ምድቦች ተመዝግበዋል (ስም፣ ምልክት፣ ቅደም ተከተል ይቀይሩ ወይም ይሰርዙ)` : `${categories.length} categories registered`}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => {
                      setEditingCategory(null);
                      setShowCategoryModal(true);
                    }}
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800 }}
                  >
                    <Plus size={14} /> {language === 'am' ? 'አዲስ ምድብ' : '+ New Category'}
                  </button>
                  <button
                    onClick={() => setShowCategoryManagerModal(false)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: 'var(--bg-subtle, #f1f5f9)',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categories.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
                    {language === 'am' ? 'ምንም ምድብ አልተገኘም' : 'No categories found'}
                  </div>
                ) : (
                  categories.map((cat, idx) => {
                    const count = menuItems.filter(m => m.category_id === cat.id).length;
                    return (
                      <div
                        key={cat.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 12,
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border)',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: 'var(--text-muted)',
                            width: 24,
                            textAlign: 'center'
                          }}>
                            #{cat.sort_order ?? (idx + 1)}
                          </span>
                          <span style={{ fontSize: 24, lineHeight: 1 }}>{cat.icon || '🍽️'}</span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
                              {cat.name}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {cat.name_amharic ? cat.name_amharic : <span style={{ fontStyle: 'italic', opacity: 0.6 }}>{language === 'am' ? 'የአማርኛ ስም የለም' : 'No Amharic translation'}</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 12,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-muted)'
                          }}>
                            {count} {language === 'am' ? 'ምግቦች' : 'items'}
                          </span>

                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setShowCategoryModal(true);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                            title={language === 'am' ? 'አስተካክል' : 'Edit'}
                          >
                            <Edit2 size={13} />
                            <span>{language === 'am' ? 'አስተካክል' : 'Edit'}</span>
                          </button>

                          <button
                            onClick={async () => {
                              const catDisplayName = language === 'am' ? (cat.name_amharic || cat.name) : cat.name;
                              let confirmMsg = language === 'am'
                                ? `እርግጠኛ ነዎት "${catDisplayName}" የተባለውን ምድብ መሰረዝ ይፈልጋሉ?`
                                : `Are you sure you want to delete category "${catDisplayName}"?`;
                              let cascade = false;
                              if (count > 0) {
                                confirmMsg = language === 'am'
                                  ? `⚠️ ማስጠንቀቂያ፡ "${catDisplayName}" ምድብ ውስጥ ${count} ምግቦች ይገኛሉ!\n\nምድቡንና በውስጡ ያሉትን ${count} ምግቦች በሙሉ መሰረዝ ይፈልጋሉ? ይህ እርምጃ ሊመለስ አይችልም።`
                                  : `⚠️ Warning: Category "${catDisplayName}" contains ${count} items!\n\nDo you want to permanently delete this category AND all its ${count} items?`;
                                cascade = true;
                              }
                              if (!window.confirm(confirmMsg)) return;

                              try {
                                await api.request(`/menu/categories/${cat.id}${cascade ? '?cascade=true' : ''}`, { method: 'DELETE' });
                                gToast.success(language === 'am' ? `ምድብ "${catDisplayName}" ተሰርዟል!` : `Category "${catDisplayName}" deleted!`);
                                if (selectedCategoryFilter === cat.id) setSelectedCategoryFilter('ALL');
                                await loadData();
                              } catch (err: any) {
                                gToast.error(err.message || 'Failed to delete category');
                              }
                            }}
                            style={{
                              padding: '6px 10px',
                              fontSize: 12,
                              borderRadius: 8,
                              border: '1px solid #fee2e2',
                              background: '#fef2f2',
                              color: '#dc2626',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            title={language === 'am' ? 'ሰርዝ' : 'Delete'}
                          >
                            <Trash2 size={13} />
                            <span>{language === 'am' ? 'ሰርዝ' : 'Delete'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 18px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-card)',
                display: 'flex',
                justifyContent: 'flex-end',
                flexShrink: 0
              }}>
                <button
                  onClick={() => setShowCategoryManagerModal(false)}
                  className="btn btn-secondary"
                  style={{ height: 40, padding: '0 18px', fontWeight: 700 }}
                >
                  {language === 'am' ? 'ዝጋ' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Category Create & Edit Modal */}
      <CreateCategoryModal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
        itemCount={menuItems.filter(m => m.category_id === editingCategory?.id).length}
        onCategorySaved={async () => {
          await loadData();
        }}
        onCategoryDeleted={async (catId: string) => {
          if (selectedCategoryFilter === catId) setSelectedCategoryFilter('ALL');
          await loadData();
        }}
      />

      {/* AI Assistant Modal for Admin */}
      <AiAssistantModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        branchId={currentBranchId}
        language={language}
        userRole="admin"
      />
    </div>
  );
};

