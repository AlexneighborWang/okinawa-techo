<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { 
  Calendar, 
  Ticket, 
  Wallet, 
  ClipboardList, 
  Users as UsersIcon,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Clock,
  Cloud,
  Sun,
  CloudRain,
  Plus,
  Plane,
  Hotel,
  Car,
  CheckCircle2,
  Check,
  Circle,
  RefreshCw,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  LayoutGrid,
  Waves,
  RotateCcw,
  AlertCircle,
  QrCode,
  Upload,
  Coins,
  CreditCard,
  Smartphone,
  Banknote,
  Navigation,
  ExternalLink,
  Languages,
  PhoneCall,
  Image as ImageIcon,
  Calculator,
  Wrench,
  Camera,
  FileText,
  Lock,
  ShieldAlert,
  Volume2,
  ArrowLeft,
  MessageSquare,
  Siren,
  Utensils,
  ShoppingBag,
  Bus,
  LifeBuoy,
  Building2,
  Sparkles
} from 'lucide-vue-next';
import { GoogleGenAI, Type } from "@google/genai";
import { db, auth } from './firebase';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  query, 
  orderBy,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';

// Views
const currentView = ref('schedule');
const selectedItem = ref<any>(null);

const views = [
  { id: 'schedule', label: '行程', icon: Calendar },
  { id: 'bookings', label: '預訂', icon: Ticket },
  { id: 'expense', label: '記帳', icon: Wallet },
  { id: 'planning', label: '準備', icon: ClipboardList },
  { id: 'tools', label: '工具', icon: Wrench },
];

// Weather Logic
const weatherLocation = ref('那霸');
const locations = ['那霸', '北谷', '名護'];
const isFetchingWeather = ref(false);

const defaultWeatherData: Record<string, any[]> = {
  '那霸': [
    { date: '9/25', day: '五', dayNum: 'Day 1', weather: 'cloud', temp: '28°C', rainProb: '20%', maxTemp: '29°C', minTemp: '24°C' },
    { date: '9/26', day: '六', dayNum: 'Day 2', weather: 'sun', temp: '30°C', rainProb: '0%', maxTemp: '31°C', minTemp: '25°C' },
    { date: '9/27', day: '日', dayNum: 'Day 3', weather: 'sun', temp: '31°C', rainProb: '10%', maxTemp: '32°C', minTemp: '26°C' },
    { date: '9/28', day: '一', dayNum: 'Day 4', weather: 'cloud', temp: '29°C', rainProb: '30%', maxTemp: '30°C', minTemp: '25°C' },
    { date: '9/29', day: '二', dayNum: 'Day 5', weather: 'rain', temp: '27°C', rainProb: '80%', maxTemp: '28°C', minTemp: '23°C' },
  ],
  '北谷': [
    { date: '9/25', day: '五', dayNum: 'Day 1', weather: 'sun', temp: '29°C', rainProb: '10%', maxTemp: '30°C', minTemp: '25°C' },
    { date: '9/26', day: '六', dayNum: 'Day 2', weather: 'sun', temp: '31°C', rainProb: '0%', maxTemp: '32°C', minTemp: '26°C' },
    { date: '9/27', day: '日', dayNum: 'Day 3', weather: 'cloud', temp: '30°C', rainProb: '20%', maxTemp: '31°C', minTemp: '25°C' },
    { date: '9/28', day: '一', dayNum: 'Day 4', weather: 'rain', temp: '28°C', rainProb: '60%', maxTemp: '29°C', minTemp: '24°C' },
    { date: '9/29', day: '二', dayNum: 'Day 5', weather: 'cloud', temp: '28°C', rainProb: '30%', maxTemp: '29°C', minTemp: '24°C' },
  ],
  '名護': [
    { date: '9/25', day: '五', dayNum: 'Day 1', weather: 'cloud', temp: '27°C', rainProb: '30%', maxTemp: '28°C', minTemp: '23°C' },
    { date: '9/26', day: '六', dayNum: 'Day 2', weather: 'rain', temp: '26°C', rainProb: '70%', maxTemp: '27°C', minTemp: '22°C' },
    { date: '9/27', day: '日', dayNum: 'Day 3', weather: 'cloud', temp: '28°C', rainProb: '40%', maxTemp: '29°C', minTemp: '24°C' },
    { date: '9/28', day: '一', dayNum: 'Day 4', weather: 'sun', temp: '30°C', rainProb: '10%', maxTemp: '31°C', minTemp: '25°C' },
    { date: '9/29', day: '二', dayNum: 'Day 5', weather: 'sun', temp: '31°C', rainProb: '0%', maxTemp: '32°C', minTemp: '26°C' },
  ],
};

const tripDays = ref([...defaultWeatherData['那霸']]);

const fetchWeatherWithGemini = async (location: string) => {
  try {
    isFetchingWeather.value = true;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `請搜尋並提供沖繩${location}從 2026/09/25 到 2026/09/29 這五天的天氣預報。請包含天氣狀態(sun/cloud/rain)、平均氣溫、最高溫、最低溫及降雨機率。請嚴格遵守以下 JSON 格式回傳陣列：
      [
        { "date": "MM/DD", "day": "英文縮寫", "weather": "sun/cloud/rain", "temp": "XX°C", "maxTemp": "XX°C", "minTemp": "XX°C", "rainProb": "XX%" }
      ]`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              day: { type: Type.STRING },
              weather: { type: Type.STRING },
              temp: { type: Type.STRING },
              maxTemp: { type: Type.STRING },
              minTemp: { type: Type.STRING },
              rainProb: { type: Type.STRING },
            },
            required: ["date", "day", "weather", "temp", "maxTemp", "minTemp", "rainProb"]
          }
        }
      }
    });
    
    const data = JSON.parse(response.text);
    if (Array.isArray(data) && data.length > 0) {
      tripDays.value = data;
    }
  } catch (error) {
    console.error("Failed to fetch weather from Gemini:", error);
    tripDays.value = defaultWeatherData[location];
  } finally {
    isFetchingWeather.value = false;
  }
};

const isWithinForecastRange = () => {
  const today = new Date();
  const departureDate = new Date('2026-09-25');
  const threeDaysBefore = new Date(departureDate);
  threeDaysBefore.setDate(departureDate.getDate() - 3);
  return today >= threeDaysBefore;
};

const handleLocationChange = (newLoc: string) => {
  weatherLocation.value = newLoc;
  if (isWithinForecastRange()) {
    fetchWeatherWithGemini(newLoc);
  } else {
    tripDays.value = defaultWeatherData[newLoc];
  }
};

onMounted(() => {
  // Check declaration memory
  if (!localStorage.getItem('okinawa_declared')) {
    showDeclarationModal.value = true;
  }
  
  if (isWithinForecastRange()) {
    fetchWeatherWithGemini(weatherLocation.value);
  }
});

// Edit Mode Logic
const isEditMode = ref(false);
const showPasswordModal = ref(false);
const passwordInput = ref('');
const showEditItemModal = ref(false);
const zoomedImageIndex = ref<number | null>(null);
const zoomedSliderRef = ref<HTMLElement | null>(null);

const hotelDetailsSliderRef = ref<HTMLElement | null>(null);
const hotelDetailsImageIndex = ref(0);

const nextHotelImage = () => {
  if (!selectedHotel.value) return;
  const total = selectedHotel.value.images.length;
  hotelDetailsImageIndex.value = (hotelDetailsImageIndex.value + 1) % total;
  if (hotelDetailsSliderRef.value) {
    const width = hotelDetailsSliderRef.value.clientWidth;
    hotelDetailsSliderRef.value.scrollTo({ left: width * hotelDetailsImageIndex.value, behavior: 'smooth' });
  }
};

const prevHotelImage = () => {
  if (!selectedHotel.value) return;
  const total = selectedHotel.value.images.length;
  hotelDetailsImageIndex.value = (hotelDetailsImageIndex.value - 1 + total) % total;
  if (hotelDetailsSliderRef.value) {
    const width = hotelDetailsSliderRef.value.clientWidth;
    hotelDetailsSliderRef.value.scrollTo({ left: width * hotelDetailsImageIndex.value, behavior: 'smooth' });
  }
};

const openZoom = (index: number, behavior: ScrollBehavior = 'auto') => {
  zoomedImageIndex.value = index;
  nextTick(() => {
    if (zoomedSliderRef.value) {
      const width = zoomedSliderRef.value.clientWidth;
      zoomedSliderRef.value.scrollTo({ left: width * index, behavior });
    }
  });
};

const nextImage = () => {
  if (!selectedHotel.value || zoomedImageIndex.value === null) return;
  const total = selectedHotel.value.images.length;
  const nextIndex = (zoomedImageIndex.value + 1) % total;
  // 如果是從最後一張到第一張，用 auto 避免長距離回滾，或者用 smooth 但使用者會看到回滾
  // 為了「滑動」感，這裡先用 smooth
  openZoom(nextIndex, 'smooth');
};

const prevImage = () => {
  if (!selectedHotel.value || zoomedImageIndex.value === null) return;
  const total = selectedHotel.value.images.length;
  const prevIndex = (zoomedImageIndex.value - 1 + total) % total;
  openZoom(prevIndex, 'smooth');
};

const editingItem = ref<any>(null);
const editingIndex = ref(-1);
const isNewItem = ref(false);
const showDeleteConfirmModal = ref(false);
const itemToDeleteIndex = ref(-1);

// Flight Details Logic
const selectedFlightCode = ref<string | null>(null);
const flightDetailsData: Record<string, any> = {
  'IT232': {
    title: '去程 IT232',
    type: 'table',
    headers: ['乘客', '託運', '餐點', '座位'],
    rows: [
      { name: '爸', baggage: '20 公斤', meal: '-', seat: '8A' },
      { name: '媽', baggage: '20 公斤', meal: '-', seat: '8B' },
      { name: '德', baggage: '20 公斤', meal: '-', seat: '9A' },
      { name: '珊', baggage: '20 公斤', meal: '-', seat: '9B' },
    ]
  },
  'FD 231': {
    title: '回程 FD 231',
    type: 'grid',
    passengers: [
      { name: '爸', items: ['Tune Protect 旅行保險套餐', '水', '託運行李 20kg', '秦叔叔海南雞飯', '7公斤隨身行李 (內含)', '座位 34A'] },
      { name: '媽', items: ['Tune Protect 旅行保險套餐', '日式照燒雞蓋飯', '水', '託運行李 20kg', '座位 34B', '7公斤隨身行李 (內含)'] },
      { name: '珊', items: ['座位 35A', 'Tune Protect 旅行保險套餐', '帕爾米拉烤雞、糯米飯佐青木瓜沙拉', '水', '託運行李 20kg', '7公斤隨身行李 (內含)'] },
      { name: '德', items: ['Tune Protect 旅行保險套餐', '水', '託運行李 20kg', '蒸海鮮咖哩佐嫩椰肉與米飯', '7公斤隨身行李 (內含)', '座位 35B'] },
    ]
  }
};

// Bookings Category Logic
const bookingCategory = ref('flight');
const bookingCategories = [
  { id: 'flight', label: '機票', icon: Plane },
  { id: 'stay', label: '住宿', icon: Hotel },
  { id: 'car', label: '租車', icon: Car },
  { id: 'ticket', label: '憑證', icon: Ticket }
];

interface HotelInfo {
  id: string;
  name: string;
  nameEn: string;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  roomType: string;
  guests: string;
  location: string;
  bookingId: string;
  images: string[];
  provider: string;
  phone?: string;
  freeCancellationDate?: string;
  mapUrl?: string;
}

const defaultHotels: HotelInfo[] = [
  {
    id: 'h1',
    name: '里士滿酒店那霸久茂地',
    nameEn: 'Richmond Hotel Naha Kumoji',
    checkInDate: '9 月 25 日 (五)',
    checkInTime: '14:00',
    checkOutDate: '9 月 27 日 (日)',
    checkOutTime: '11:00',
    roomType: '雙床房, 非吸煙房 (For 4 people)',
    guests: '4位成人',
    location: '2-23-12 Kumoji, Naha, Okinawa-ken, 900-0015 日本',
    bookingId: '73416254149486',
    images: ['https://picsum.photos/seed/richmond/600/300'],
    provider: 'Hotels.com',
    phone: '+81988690077',
    freeCancellationDate: '2026-09-18',
    mapUrl: 'https://maps.app.goo.gl/epAvVFUYHgMrwuoBA'
  },
  {
    id: 'h2',
    name: '美濱拉平住宅飯店',
    nameEn: 'LAPIN MIHAMA RESIDENCE HOTEL',
    checkInDate: '9 月 27 日 (日)',
    checkInTime: '15:00',
    checkOutDate: '9 月 28 日 (一)',
    checkOutTime: '10:00',
    roomType: '標準家庭房',
    guests: '4位成人',
    location: '沖繩, 北谷町, Mihama 2-1-13, 日本',
    bookingId: '5719028315',
    images: ['https://picsum.photos/seed/vessel/600/300'],
    provider: 'Booking.com',
    phone: '+81989898903',
    freeCancellationDate: '2026-09-19',
    mapUrl: 'https://maps.app.goo.gl/upQoLCfskNKSUgMg8'
  },
  {
    id: 'h3',
    name: '名護櫻之家飯店',
    nameEn: 'Hotel Sakurano Familia Nago',
    checkInDate: '9 月 28 日 (一)',
    checkInTime: '15:00',
    checkOutDate: '9 月 29 日 (二)',
    checkOutTime: '11:00',
    roomType: '加大雙人床房一附 2 張加大雙人床 (附早餐)',
    guests: '4位成人',
    location: '沖繩, 名護, Agarie 5-6503-4, 日本',
    bookingId: '6199768799',
    images: ['https://picsum.photos/seed/phoenix/600/300'],
    provider: 'Booking.com',
    phone: '+81980537070',
    freeCancellationDate: '2026-09-20',
    mapUrl: 'https://maps.app.goo.gl/CjHNaFBht7rQegDB7'
  }
];

const hotels = ref<HotelInfo[]>(JSON.parse(localStorage.getItem('okinawa_hotels') || JSON.stringify(defaultHotels)));

// Data Migration & Sync Logic
const migrateAndSync = () => {
  let needsSave = false;
  
  // 1. Recover old images from the previous single-hotel version
  const oldImages = localStorage.getItem('okinawa_hotel_images');
  if (oldImages) {
    try {
      const parsedOld = JSON.parse(oldImages);
      const h1 = hotels.value.find(h => h.id === 'h1');
      if (h1 && h1.images.length <= 1 && h1.images[0].includes('picsum.photos')) {
        h1.images = Array.isArray(parsedOld) ? parsedOld : [parsedOld];
        localStorage.removeItem('okinawa_hotel_images'); // Clean up after migration
        needsSave = true;
      }
    } catch (e) {
      console.error('Migration failed', e);
    }
  }

  // 2. Sync the specific booking ID and details for h2
  let h2 = hotels.value.find(h => h.id === 'h2');
  const defH2 = defaultHotels.find(h => h.id === 'h2')!;
  
  if (!h2) {
    h2 = { ...defH2 };
    hotels.value.push(h2);
    needsSave = true;
  } else {
    // Force update to ensure UI reflects the latest code changes
    h2.bookingId = defH2.bookingId;
    h2.phone = defH2.phone;
    h2.roomType = defH2.roomType;
    h2.checkInTime = defH2.checkInTime;
    h2.checkOutTime = defH2.checkOutTime;
    h2.location = defH2.location;
    h2.name = defH2.name;
    h2.nameEn = defH2.nameEn;
    needsSave = true;
  }

  // 3. Ensure h3 exists in the current state
  if (!hotels.value.find(h => h.id === 'h3')) {
    const h3 = defaultHotels.find(h => h.id === 'h3');
    if (h3) {
      hotels.value.push(h3);
      needsSave = true;
    }
  }

  // 4. Sync freeCancellationDate for all hotels if missing
  hotels.value.forEach(h => {
    const def = defaultHotels.find(dh => dh.id === h.id);
    if (def && def.freeCancellationDate && !h.freeCancellationDate) {
      h.freeCancellationDate = def.freeCancellationDate;
      needsSave = true;
    }
  });

  // 5. Update names and navigation queries ONLY if missing
  hotels.value.forEach(h => {
    const def = defaultHotels.find(dh => dh.id === h.id);
    if (def) {
      if (!h.name) h.name = def.name;
      if (!h.nameEn) h.nameEn = def.nameEn;
      if (!h.mapUrl) h.mapUrl = def.mapUrl;
      if (!h.roomType) h.roomType = def.roomType;
      needsSave = true;
    }
  });

  if (needsSave) {
    localStorage.setItem('okinawa_hotels', JSON.stringify(hotels.value));
    // If logged in, sync the corrected data to Firebase
    if (userId.value) {
      hotels.value.forEach(h => {
        syncToFirebase('hotels', h.id, h);
      });
    }
  }
};

// migrateAndSync(); // Moved to onMounted/Auth

const esimMembers = ['爸', '媽', '德', '珊'];
const esims = ref<string[]>(JSON.parse(localStorage.getItem('okinawa_esims') || '["", "", "", ""]'));
const selectedHotel = ref<HotelInfo | null>(null);

// Toast System
const toast = reactive({
  show: false,
  message: '',
  type: 'info' as 'info' | 'error' | 'success'
});

const showToast = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
  toast.message = msg;
  toast.type = type;
  toast.show = true;
  setTimeout(() => {
    toast.show = false;
  }, 3000);
};

// Expense Form Logic
const expenseSubView = ref('input'); // 'input' or 'details'
const showExpenseModal = ref(false);
const editingExpenseId = ref<number | null>(null);
const expenseForm = reactive({
  date: new Date().toISOString().split('T')[0],
  currency: 'JPY',
  amount: 0,
  twdAmount: 0,
  paymentMethod: '現金',
  location: '',
  item: '',
  payer: '德'
});

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

const exchangeRates = reactive<Record<string, number>>({
  'JPY': 0.21, // Default fallback
  'TWD': 1
});

const isExchangeUpdateAllowed = computed(() => {
  const today = new Date();
  const departureDate = new Date('2026-09-25');
  const threeDaysBefore = new Date(departureDate);
  threeDaysBefore.setDate(departureDate.getDate() - 3);
  return today >= threeDaysBefore;
});

const fetchExchangeRate = async () => {
  if (!isExchangeUpdateAllowed.value) return;
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/JPY');
    const data = await response.json();
    if (data && data.rates && data.rates.TWD) {
      exchangeRates['JPY'] = Number(data.rates.TWD.toFixed(3));
      showToast('匯率已更新', 'success');
    }
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);
    showToast('匯率更新失敗，使用預設值', 'error');
  }
};

onMounted(() => {
  fetchExchangeRate();
});

watch(() => [expenseForm.amount, expenseForm.currency], () => {
  const rate = exchangeRates[expenseForm.currency] || 1;
  expenseForm.twdAmount = Math.round(expenseForm.amount * rate);
});

const expenses = ref<any[]>(JSON.parse(localStorage.getItem('okinawa_expenses') || '[]'));

const saveExpense = async () => {
  if (!expenseForm.item) {
    showToast('請輸入消費項目', 'error');
    return;
  }
  if (expenseForm.amount <= 0) {
    showToast('請輸入有效金額', 'error');
    return;
  }
  
  const id = editingExpenseId.value ? editingExpenseId.value.toString() : Date.now().toString();
  const expenseData = { ...expenseForm, id };

  if (editingExpenseId.value) {
    const index = expenses.value.findIndex(e => e.id === editingExpenseId.value);
    if (index !== -1) {
      expenses.value[index] = expenseData;
    }
    editingExpenseId.value = null;
    showToast('紀錄已更新', 'success');
  } else {
    expenses.value.unshift(expenseData);
    showToast('紀錄已儲存', 'success');
  }
  
  localStorage.setItem('okinawa_expenses', JSON.stringify(expenses.value));
  showExpenseModal.value = false;
  
  // Sync to Firebase
  await syncToFirebase('expenses', id, expenseData);

  // Reset form
  expenseForm.amount = 0;
  expenseForm.twdAmount = 0;
  expenseForm.location = '';
  expenseForm.item = '';
};

const editExpense = (expense: any) => {
  editingExpenseId.value = expense.id;
  Object.assign(expenseForm, {
    date: expense.date,
    currency: expense.currency,
    amount: expense.amount,
    twdAmount: expense.twdAmount,
    paymentMethod: expense.paymentMethod,
    location: expense.location,
    item: expense.item,
    payer: expense.payer
  });
  expenseSubView.value = 'input';
  showToast('進入編輯模式');
};

const cancelEdit = () => {
  editingExpenseId.value = null;
  expenseForm.amount = 0;
  expenseForm.twdAmount = 0;
  expenseForm.location = '';
  expenseForm.item = '';
  expenseSubView.value = 'details';
  showToast('已取消編輯');
};

const deleteExpense = async (id: any) => {
  expenses.value = expenses.value.filter(e => e.id !== id);
  localStorage.setItem('okinawa_expenses', JSON.stringify(expenses.value));
  showToast('紀錄已刪除', 'info');
  
  // Sync to Firebase
  await deleteFromFirebase('expenses', id.toString());
};

// Planning Logic
const planningTab = ref('todo'); // 'todo', 'packing', 'shopping'
const planningFilterMember = ref('全體');
const newItemText = ref('');
const editingPlanningId = ref<number | null>(null);
const editingPlanningText = ref('');
const confirmingDeleteId = ref<number | null>(null);
const selectedBagType = ref('隨身小包');

const defaultPlanning = {
  todo: [
    { id: 1, text: '預約租車', completed: true, member: '全體' },
    { id: 2, text: '換日幣', completed: false, member: '全體' },
    { id: 3, text: '申請國際駕照', completed: false, member: '全體' },
    { id: 4, text: '購買保險', completed: false, member: '全體' },
    { id: 5, text: '預約餐廳', completed: false, member: '全體' }
  ],
  packing: [
    { id: 6, text: '護照', completed: false, member: '全體' },
    { id: 7, text: '日幣現金', completed: false, member: '全體' },
    { id: 8, text: '駕照正本+譯本', completed: false, member: '全體' }
  ],
  shopping: [
    { id: 9, text: '合利他命', completed: false, member: '全體' },
    { id: 10, text: '蒟蒻果凍', completed: false, member: '全體' }
  ]
};

const planningData = ref(JSON.parse(localStorage.getItem('okinawa_planning') || JSON.stringify(defaultPlanning)));

const planningProgress = computed(() => {
  const stats: Record<string, { percent: number, completed: number, total: number }> = {};
  ['todo', 'packing', 'shopping'].forEach(tab => {
    const items = planningData.value[tab];
    const total = items.length;
    const completed = items.filter((i: any) => i.completed).length;
    stats[tab] = {
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
      completed,
      total
    };
  });
  return stats;
});

// Restore missing default todo items if requested
const restoreDefaults = () => {
  const currentTodoTexts = new Set(planningData.value.todo.map((i: any) => i.text));
  defaultPlanning.todo.forEach(item => {
    if (!currentTodoTexts.has(item.text)) {
      planningData.value.todo.push({ ...item, id: Date.now() + Math.random() });
    }
  });
  savePlanning();
  showToast('已恢復預設待辦項目', 'success');
};

const savePlanning = () => {
  localStorage.setItem('okinawa_planning', JSON.stringify(planningData.value));
};

const addPlanningItem = async () => {
  if (!newItemText.value.trim()) return;
  const id = Date.now().toString();
  const itemData = {
    id,
    text: newItemText.value,
    completed: false,
    member: planningTab.value === 'todo' ? '全體' : planningFilterMember.value,
    tab: planningTab.value,
    bagType: planningTab.value === 'packing' ? selectedBagType.value : undefined
  };
  
  planningData.value[planningTab.value].unshift(itemData);
  newItemText.value = '';
  savePlanning();
  showToast('已新增項目', 'success');
  
  // Sync to Firebase
  await syncToFirebase('planning', id, itemData);
};

const handleEditToggle = (item: any) => {
  if (editingPlanningId.value === item.id) {
    saveEditPlanning(item);
  } else {
    startEditPlanning(item);
  }
};

const startEditPlanning = (item: any) => {
  editingPlanningId.value = item.id;
  editingPlanningText.value = item.text;
};

const saveEditPlanning = async (item: any) => {
  if (editingPlanningText.value.trim()) {
    item.text = editingPlanningText.value;
    savePlanning();
    showToast('已更新項目', 'success');
    
    // Sync to Firebase
    await syncToFirebase('planning', item.id.toString(), { ...item, tab: planningTab.value });
  }
  editingPlanningId.value = null;
};

const togglePlanningItem = async (item: any) => {
  if (editingPlanningId.value === item.id) return;
  item.completed = !item.completed;
  
  const itemMember = item.member || '全體';
  if (item.completed && itemMember === '全體' && planningFilterMember.value !== '全體') {
    item.completedBy = planningFilterMember.value;
  } else if (!item.completed) {
    delete item.completedBy;
  }
  
  savePlanning();
  
  // Sync to Firebase
  await syncToFirebase('planning', item.id.toString(), { ...item, tab: planningTab.value });
};

const confirmDeletePlanning = (id: any) => {
  if (confirmingDeleteId.value === id) {
    deletePlanningItem(planningTab.value, id);
    confirmingDeleteId.value = null;
  } else {
    confirmingDeleteId.value = id;
    // Auto reset after 3 seconds
    setTimeout(() => {
      if (confirmingDeleteId.value === id) confirmingDeleteId.value = null;
    }, 3000);
  }
};

const deletePlanningItem = async (tab: string, id: any) => {
  planningData.value[tab] = planningData.value[tab].filter((item: any) => item.id !== id);
  savePlanning();
  showToast('已刪除項目', 'info');
  
  // Sync to Firebase
  await deleteFromFirebase('planning', id.toString());
};

const filteredPlanningData = computed(() => {
  const data = planningData.value[planningTab.value];
  
  // Filter by selected member
  // If a specific member is selected, also include items belonging to '全體'
  const filtered = planningFilterMember.value === '全體' 
    ? data 
    : data.filter((i: any) => {
        const m = i.member || '全體';
        return m === planningFilterMember.value || m === '全體';
      });

  const groups: Record<string, any[]> = {};
  
  if (planningTab.value === 'packing') {
    // Group packing by bag type
    const bagTypes = ['隨身小包', '後背包', '行李箱', '未分類'];
    filtered.forEach((item: any) => {
      const b = item.bagType || '未分類';
      if (!groups[b]) groups[b] = [];
      groups[b].push(item);
    });
    
    const sortedGroups: Record<string, any[]> = {};
    bagTypes.forEach(b => {
      if (groups[b]) sortedGroups[b] = groups[b];
    });
    return sortedGroups;
  }

  if (planningTab.value === 'todo') return { '全部': filtered };

  // Define the order of groups to ensure '全體' is always visible or consistent
  const members = ['全體', '德', '媽', '爸', '珊'];
  
  filtered.forEach((item: any) => {
    const m = item.member || '全體';
    if (!groups[m]) groups[m] = [];
    groups[m].push(item);
  });

  // Sort groups based on our member order
  const sortedGroups: Record<string, any[]> = {};
  members.forEach(m => {
    if (groups[m]) sortedGroups[m] = groups[m];
  });
  
  // Add any other groups not in our predefined list
  Object.keys(groups).forEach(m => {
    if (!sortedGroups[m]) sortedGroups[m] = groups[m];
  });

  return sortedGroups;
});

// Tools Logic
const toolSubView = ref('main'); // 'main', 'phrases', 'emergency'
const toolJpyAmount = ref<number | string>('');
const toolExchangeRate = computed(() => exchangeRates['JPY'] || 0.204);
const toolTwdAmount = computed(() => {
  const jpy = Number(toolJpyAmount.value) || 0;
  return Math.round(jpy * toolExchangeRate.value);
});

const speak = (text: string) => {
  if (!window.speechSynthesis) {
    showToast('您的瀏覽器不支援語音播放', 'error');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
};

const travelPhraseCategories = [
  {
    id: 'basic',
    label: '基本問候',
    icon: '👋',
    phrases: [
      { jp: 'すみません', ro: 'Sumimasen', cn: '不好意思 / 請問' },
      { jp: 'ありがとう', ro: 'Arigatou', cn: '謝謝' },
      { jp: 'こんにちは', ro: 'Konnichiwa', cn: '你好 (白天)' },
      { jp: '日本語は話せません', ro: 'Nihongo wa hanasemasen', cn: '我不會說日文' }
    ]
  },
  {
    id: 'shopping',
    label: '購物 / 結帳',
    icon: '🛍️',
    phrases: [
      { jp: 'これをお願いします', ro: 'Kore o onegaishimasu', cn: '我要這個' },
      { jp: 'いくらですか？', ro: 'Ikura desu ka?', cn: '請問多少錢？' },
      { jp: '袋いりません', ro: 'Fukuro irimasen', cn: '不用袋子' },
      { jp: '免税できますか？', ro: 'Menzei dekimasu ka?', cn: '可以退稅嗎？' },
      { jp: 'クレジットカードは使えますか？', ro: 'Kurejitto ka-do wa tsukaemasu ka?', cn: '可以用信用卡嗎？' }
    ]
  },
  {
    id: 'dining',
    label: '餐廳用餐',
    icon: '🍜',
    phrases: [
      { jp: '大人4名です', ro: 'Otona yonmei desu', cn: '4位大人' },
      { jp: 'メニューをください', ro: 'Menyu o kudasai', cn: '請給我菜單' },
      { jp: 'お水ください', ro: 'Omizu kudasai', cn: '請給我水' },
      { jp: 'お会計お願いします', ro: 'Okaikei onegaishimasu', cn: '請結帳' }
    ]
  },
  {
    id: 'transport',
    label: '交通 / 問路',
    icon: '🚌',
    phrases: [
      { jp: 'トイレはどこですか？', ro: 'Toire wa doko desu ka?', cn: '廁所在哪裡？' },
      { jp: '駐車場はどこですか？', ro: 'Chuushajo wa doko desu ka?', cn: '停車場在哪裡？' },
      { jp: 'この場所に行きたいです', ro: 'Kono basho ni ikitai desu', cn: '我想去這裡 (指地圖)' }
    ]
  },
  {
    id: 'emergency_phrases',
    label: '緊急狀況',
    icon: '🚑',
    phrases: [
      { jp: '助けてください', ro: 'Tasukete kudasai', cn: '請幫幫我' },
      { jp: '警察を呼んでください', ro: 'Keisatsu o yonde kudasai', cn: '請叫警察' },
      { jp: '病院はどこですか？', ro: 'Byouin wa doko desu ka?', cn: '醫院在哪裡？' }
    ]
  }
];

const emergencyContacts = [
  { label: '報警 (警察局)', value: '110', icon: ShieldAlert, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: '火警 / 救護車', value: '119', icon: PhoneCall, color: 'text-red-600', bg: 'bg-red-50' },
  { label: '海上急救', value: '118', icon: LifeBuoy, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { label: '台北駐日經濟文化代表處 那霸分處', value: '+81-98-862-7008', sub: '沖繩縣那霸市久茂地3-15-9', icon: Building2, color: 'text-slate-600', bg: 'bg-slate-50' },
  { label: '外交部旅外國人急難救助', value: '0800-085-095', icon: PhoneCall, color: 'text-emerald-600', bg: 'bg-emerald-50' }
];

const groupedExpenses = computed(() => {
  const sorted = [...expenses.value].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.id - a.id;
  });
  
  const groups: { date: string, items: any[], totalTwd: number }[] = [];
  sorted.forEach(expense => {
    let group = groups.find(g => g.date === expense.date);
    if (!group) {
      group = { date: expense.date, items: [], totalTwd: 0 };
      groups.push(group);
    }
    group.items.push(expense);
    group.totalTwd += expense.twdAmount;
  });
  return groups;
});

const totalJpy = computed(() => {
  return expenses.value.reduce((sum, e) => {
    if (e.currency === 'JPY') return sum + e.amount;
    return sum + (e.amount * exchangeRates[e.currency] / exchangeRates['JPY']);
  }, 0);
});

const totalTwd = computed(() => Math.round(totalJpy.value * exchangeRates['JPY']));

const handleEsimUpload = (event: Event, index: number) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      esims.value[index] = result;
      localStorage.setItem('okinawa_esims', JSON.stringify(esims.value));
    };
    reader.readAsDataURL(target.files[0]);
  }
};

const removeEsim = (index: number) => {
  esims.value[index] = "";
  localStorage.setItem('okinawa_esims', JSON.stringify(esims.value));
};

const triggerEsimUpload = (index: number) => {
  const input = document.getElementById(`esim-input-${index}`);
  if (input) input.click();
};

const compressImage = (base64Str: string, maxWidth = 600): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.4)); // 降低品質至 0.4 以確保檔案更小
    };
  });
};

const handleHotelImageUpload = (event: Event, hotelId: string) => {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    const hotel = hotels.value.find(h => h.id === hotelId);
    if (!hotel) return;

    // 限制最多 8 張照片 (稍微放寬一點)
    if (hotel.images.length >= 8) {
      showToast('每個住宿點最多只能上傳 8 張照片', 'error');
      return;
    }

    const filesToUpload = Array.from(target.files).slice(0, 8 - hotel.images.length);

    filesToUpload.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawResult = e.target?.result as string;
        try {
          const compressedResult = await compressImage(rawResult);
          hotel.images.push(compressedResult);
          localStorage.setItem('okinawa_hotels', JSON.stringify(hotels.value));
          await syncToFirebase('hotels', hotelId, hotel);
          showToast('照片上傳成功', 'success');
        } catch (err) {
          console.error('Upload failed:', err);
          showToast('上傳失敗，圖片可能太大', 'error');
        }
      };
      reader.readAsDataURL(file);
    });
  }
};

const removeHotelImage = async (hotelId: string, index: number) => {
  const hotel = hotels.value.find(h => h.id === hotelId);
  if (!hotel) return;

  hotel.images.splice(index, 1);
  if (hotel.images.length === 0) {
    hotel.images = [`https://picsum.photos/seed/${hotel.id}/600/300`];
  }
  localStorage.setItem('okinawa_hotels', JSON.stringify(hotels.value));
  await syncToFirebase('hotels', hotelId, hotel);
};

const triggerHotelImageUpload = (hotelId: string) => {
  const input = document.getElementById(`hotel-image-input-${hotelId}`);
  if (input) input.click();
};

const openHotelModal = (hotel: HotelInfo) => {
  // Double check cancellation date sync
  if (!hotel.freeCancellationDate) {
    const def = defaultHotels.find(dh => dh.id === hotel.id);
    if (def) hotel.freeCancellationDate = def.freeCancellationDate;
  }
  selectedHotel.value = hotel;
};

// Declaration Modal Logic
const showDeclarationModal = ref(false);
const hasDeclared = ref(!!localStorage.getItem('okinawa_declared'));

const closeDeclaration = () => {
  showDeclarationModal.value = false;
  localStorage.setItem('okinawa_declared', 'true');
  hasDeclared.value = true;
};

const resetDeclaration = () => {
  localStorage.removeItem('okinawa_declared');
  hasDeclared.value = false;
  alert('行前宣示已重置，下次開啟 App 將再次顯示。');
};

const toggleEditMode = () => {
  if (isEditMode.value) {
    isEditMode.value = false;
  } else {
    showPasswordModal.value = true;
    passwordInput.value = '';
  }
};

const verifyPassword = () => {
  if (passwordInput.value === '0619') {
    isEditMode.value = true;
    showPasswordModal.value = false;
  } else {
    alert('密碼錯誤！');
  }
};

const addNewItem = () => {
  isNewItem.value = true;
  editingItem.value = {
    time: '09:00',
    title: '',
    type: 'sightseeing',
    typeLabel: '景點',
    location: '',
    color: 'bg-emerald-100 text-emerald-600',
    note: '',
    travelTime: ''
  };
  showEditItemModal.value = true;
};

const editItem = (item: any, index: number) => {
  isNewItem.value = false;
  editingIndex.value = index;
  editingItem.value = { ...item };
  showEditItemModal.value = true;
};

const saveItem = async () => {
  const items = allScheduleItems[selectedDay.value];
  const id = isNewItem.value ? Date.now().toString() : editingItem.value.id;
  const itemData = { ...editingItem.value, day: selectedDay.value, id };
  
  if (isNewItem.value) {
    items.push(itemData);
  } else {
    if (editingIndex.value !== -1) {
      items[editingIndex.value] = itemData;
    }
  }
  
  // Sort by time
  items.sort((a, b) => a.time.localeCompare(b.time));
  showEditItemModal.value = false;
  editingIndex.value = -1;
  
  // Sync to Firebase
  await syncToFirebase('schedule', id, itemData);
};

const deleteItem = (index: number) => {
  itemToDeleteIndex.value = index;
  showDeleteConfirmModal.value = true;
};

const confirmDelete = async () => {
  if (itemToDeleteIndex.value !== -1) {
    const item = allScheduleItems[selectedDay.value][itemToDeleteIndex.value];
    allScheduleItems[selectedDay.value].splice(itemToDeleteIndex.value, 1);
    showDeleteConfirmModal.value = false;
    
    // Sync to Firebase
    if (item.id) {
      await deleteFromFirebase('schedule', item.id);
    }
    itemToDeleteIndex.value = -1;
  }
};

const moveItem = (index: number, direction: 'up' | 'down') => {
  const items = allScheduleItems[selectedDay.value];
  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex >= 0 && newIndex < items.length) {
    const temp = items[index];
    items[index] = items[newIndex];
    items[newIndex] = temp;
  }
};

const updateTypeLabel = () => {
  const typeMap: Record<string, { label: string, color: string }> = {
    transport: { label: '交通', color: 'bg-blue-100 text-blue-600' },
    food: { label: '美食', color: 'bg-orange-100 text-orange-600' },
    sightseeing: { label: '景點', color: 'bg-emerald-100 text-emerald-600' },
    accommodation: { label: '住宿', color: 'bg-purple-100 text-purple-600' }
  };
  const config = typeMap[editingItem.value.type];
  if (config) {
    editingItem.value.typeLabel = config.label;
    editingItem.value.color = config.color;
  }
};

// App Titles
const mainTitle = ref(localStorage.getItem('okinawa_main_title') || '2026沖繩五日遊');
const subTitle = ref(localStorage.getItem('okinawa_sub_title') || '王姥姥進大琉球GO');

// Mock Data
const selectedDay = ref('9/25');

const defaultScheduleItems = {
  '9/25': [
    { time: '20:50', title: '那霸機場', type: 'transport', typeLabel: '交通', location: 'Naha Airport', color: 'bg-blue-100 text-blue-600', note: 'IT 232 抵達沖繩，辦理入境。' },
    { time: '21:50', title: '那霸機場站', type: 'transport', typeLabel: '交通', location: '那霸機場站', color: 'bg-blue-100 text-blue-600', note: '步行至國內線航廈 2 樓。' },
    { time: '22:00', title: '搭乘單軌電車', type: 'transport', typeLabel: '交通', location: '美榮橋站', color: 'bg-blue-100 text-blue-600', note: '車資 ¥300，約 15 分鐘。' },
    { time: '22:20', title: '里士滿那霸久茂地酒店', type: 'accommodation', typeLabel: '住宿', location: 'Richmond Hotel Naha Kumoji', color: 'bg-purple-100 text-purple-600', note: '步行約 5 分鐘抵達飯店 Check-in。' },
    { time: '22:45', title: '國際通宵夜', type: 'food', typeLabel: '美食', location: '國際通', color: 'bg-orange-100 text-orange-600', note: '自由選擇暖暮拉麵或居酒屋。' },
  ],
  '9/26': [
    { time: '09:20', title: '波上宮', type: 'sightseeing', typeLabel: '景點', location: 'Naminoue Shrine', color: 'bg-emerald-100 text-emerald-600', note: '參拜、購買御守、海灘拍照。' },
    { time: '10:30', title: '第一牧志公設市場', type: 'food', typeLabel: '美食', location: 'Makishi Market', color: 'bg-orange-100 text-orange-600', note: '午餐推薦海鮮、天婦羅。' },
    { time: '13:00', title: '搭乘計程車', type: 'transport', typeLabel: '交通', location: '新都心', color: 'bg-blue-100 text-blue-600', note: '前往新都心（車資約 ¥1,300）。' },
    { time: '14:00', title: 'San-A Naha Main Place', type: 'sightseeing', typeLabel: '景點', location: 'San-A Naha Main Place', color: 'bg-emerald-100 text-emerald-600', note: '大型超市與日系百貨採買。' },
    { time: '16:30', title: '國際通', type: 'sightseeing', typeLabel: '景點', location: '國際通', color: 'bg-emerald-100 text-emerald-600', note: '逛街、買伴手禮、逛藥妝店。' },
    { time: '19:30', title: '國際通晚餐', type: 'food', typeLabel: '美食', location: '國際通', color: 'bg-orange-100 text-orange-600', note: '自由選擇晚餐。' },
  ],
  '9/27': [
    { time: '09:00', title: '租車公司取車', type: 'transport', typeLabel: '交通', location: '美榮橋站附近', color: 'bg-blue-100 text-blue-600', note: '開始自駕行程。' },
    { time: '09:30', title: '泊港漁市場', type: 'food', typeLabel: '美食', location: 'Tomari Iyumachi', color: 'bg-orange-100 text-orange-600', note: '海鮮早餐（推薦：生蠔、海膽燒）。' },
    { time: '10:30', title: '漁師食堂 大盤振舞', type: 'food', typeLabel: '美食', location: 'Ryoshi Shokudo Obanburumai Sakana Daitoryo', color: 'bg-orange-100 text-orange-600', note: '超豪邁海鮮丼飯，就在漁市場附近。' },
    { time: '12:00', title: 'San-A PARCO CITY', type: 'food', typeLabel: '美食', location: 'San-A PARCO CITY', color: 'bg-orange-100 text-orange-600', note: '午餐（無敵海景美食街）＋逛百貨。' },
    { time: '16:00', title: '美國村', type: 'sightseeing', typeLabel: '景點', location: 'American Village', color: 'bg-emerald-100 text-emerald-600', note: '散步看夕陽、拍照（推薦：Sunset Beach）。' },
    { time: '19:00', title: '琉球之牛燒肉', type: 'food', typeLabel: '美食', location: '琉球之牛', color: 'bg-orange-100 text-orange-600', note: '建議預約，或迴轉壽司市場。' },
  ],
  '9/28': [
    { time: '07:30', title: '豬肉蛋飯糰 Potama', type: 'food', typeLabel: '美食', location: '豬肉蛋飯糰 Potama', color: 'bg-orange-100 text-orange-600', note: '外帶早餐（車上享用）。' },
    { time: '08:45', title: '萬座毛', type: 'sightseeing', typeLabel: '景點', location: 'Manzamo', color: 'bg-emerald-100 text-emerald-600', note: '景點拍照、欣賞象鼻岩。' },
    { time: '10:00', title: '道之驛許田', type: 'sightseeing', typeLabel: '景點', location: 'Kyoda Rest Area', color: 'bg-emerald-100 text-emerald-600', note: '購買優惠實體票（需現金）。' },
    { time: '11:00', title: '名護漁港食堂', type: 'food', typeLabel: '美食', location: '名護漁港食堂', color: 'bg-orange-100 text-orange-600', note: '僅收現金，推鮪魚丼、漁師汁。' },
    { time: '12:50', title: '古宇利島海洋塔', type: 'sightseeing', typeLabel: '景點', location: 'Kouri Ocean Tower', color: 'bg-emerald-100 text-emerald-600', note: '看 Tiffany 藍海景。' },
    { time: '14:30', title: '美麗海水族館', type: 'sightseeing', typeLabel: '景點', location: 'Churaumi Aquarium', color: 'bg-emerald-100 text-emerald-600', note: '海豚秀、鯨鯊餵食秀、黑潮探險。' },
    { time: '17:00', title: 'Shinmei Coffee', type: 'food', typeLabel: '美食', location: 'Shinmei Coffee Okinawa', color: 'bg-orange-100 text-orange-600', note: '在備瀨附近的特色咖啡廳，稍作休息。' },
    { time: '17:45', title: '備瀨一線天', type: 'sightseeing', typeLabel: '景點', location: 'Bise no Warumi', color: 'bg-emerald-100 text-emerald-600', note: '神聖的海邊岩石裂縫秘境，鄰近水族館。' },
    { time: '19:30', title: 'Yakiniku Kochan', type: 'food', typeLabel: '美食', location: 'Yakiniku Kochan', color: 'bg-orange-100 text-orange-600', note: '燒肉晚餐（建議預約）。' },
  ],
  '9/29': [
    { time: '09:00', title: '玉泉洞 / 沖繩世界', type: 'sightseeing', typeLabel: '景點', location: 'Okinawa World', color: 'bg-emerald-100 text-emerald-600', note: '探索鐘乳石洞。' },
    { time: '10:45', title: '瀨長島幸福鬆餅', type: 'food', typeLabel: '美食', location: '幸福鬆餅', color: 'bg-orange-100 text-orange-600', note: '直接去 32 號店鋪點餐外帶。' },
    { time: '11:45', title: 'ASHIBINAA Outlet', type: 'sightseeing', typeLabel: '景點', location: 'ASHIBINAA Outlet', color: 'bg-emerald-100 text-emerald-600', note: '最後採買。' },
    { time: '13:30', title: '豐崎還車', type: 'transport', typeLabel: '交通', location: '豐崎租車店', color: 'bg-blue-100 text-blue-600', note: '建議預留加油時間。' },
    { time: '14:30', title: '那霸機場', type: 'transport', typeLabel: '交通', location: '那霸機場', color: 'bg-blue-100 text-blue-600', note: '國內線航廈 2 樓最後採購伴手禮。' },
    { time: '16:55', title: '搭機返台', type: 'transport', typeLabel: '交通', location: '那霸機場', color: 'bg-blue-100 text-blue-600', note: 'FD 231 返程。' },
  ],
};

const savedSchedule = localStorage.getItem('okinawa_schedule');
const allScheduleItems = reactive<Record<string, any[]>>(savedSchedule ? JSON.parse(savedSchedule) : defaultScheduleItems);

const isAuthReady = ref(false);
const userId = ref<string | null>(null);

// Firebase Sync Logic
const syncToFirebase = async (collectionName: string, id: string, data: any) => {
  if (!userId.value) return;
  try {
    // Check data size (rough estimate)
    const dataStr = JSON.stringify(data);
    const sizeInBytes = new Blob([dataStr]).size;
    if (sizeInBytes > 1000000) {
      showToast(`資料過大 (${(sizeInBytes / 1024 / 1024).toFixed(2)}MB)，無法同步到雲端。請減少圖片數量。`, 'error');
      return;
    }

    await setDoc(doc(db, collectionName, id), {
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: userId.value
    });
  } catch (error) {
    console.error(`Failed to sync to ${collectionName}:`, error);
  }
};

const deleteFromFirebase = async (collectionName: string, id: string) => {
  if (!userId.value) return;
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    console.error(`Failed to delete from ${collectionName}:`, error);
  }
};

onMounted(async () => {
  // Initialize Auth
  onAuthStateChanged(auth, (user) => {
    if (user) {
      userId.value = user.uid;
      isAuthReady.value = true;
      migrateAndSync();
      setupRealtimeListeners();
    } else {
      isAuthReady.value = false;
    }
  });
});

const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    showToast('登入成功', 'success');
  } catch (error) {
    console.error("Login failed:", error);
    showToast('登入失敗', 'error');
  }
};

let unsubscribes: (() => void)[] = [];

const isSyncing = reactive({
  schedule: false,
  expenses: false,
  planning: false,
  hotels: false
});

const setupRealtimeListeners = () => {
  // Clear existing listeners
  unsubscribes.forEach(unsub => unsub());
  unsubscribes = [];

  isSyncing.schedule = true;
  isSyncing.expenses = true;
  isSyncing.planning = true;
  isSyncing.hotels = true;

  // 1. Schedule Sync
  const scheduleUnsub = onSnapshot(collection(db, 'schedule'), (snapshot) => {
    isSyncing.schedule = false;
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      const day = data.day;
      if (!allScheduleItems[day]) allScheduleItems[day] = [];
      
      if (change.type === 'added' || change.type === 'modified') {
        const index = allScheduleItems[day].findIndex(item => item.id === change.doc.id);
        const newItem = { ...data, id: change.doc.id };
        if (index !== -1) {
          allScheduleItems[day][index] = newItem;
        } else {
          allScheduleItems[day].push(newItem);
        }
      } else if (change.type === 'removed') {
        allScheduleItems[day] = allScheduleItems[day].filter(item => item.id !== change.doc.id);
      }
      allScheduleItems[day].sort((a, b) => a.time.localeCompare(b.time));
    });
  });
  unsubscribes.push(scheduleUnsub);

  // 2. Expenses Sync
  const expensesUnsub = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snapshot) => {
    isSyncing.expenses = false;
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      if (change.type === 'added' || change.type === 'modified') {
        const index = expenses.value.findIndex(e => e.id === change.doc.id);
        const newExpense = { ...data, id: change.doc.id };
        if (index !== -1) {
          expenses.value[index] = newExpense;
        } else {
          expenses.value.unshift(newExpense);
        }
      } else if (change.type === 'removed') {
        expenses.value = expenses.value.filter(e => e.id !== change.doc.id);
      }
    });
  });
  unsubscribes.push(expensesUnsub);

  // 3. Planning Sync
  const planningUnsub = onSnapshot(collection(db, 'planning'), (snapshot) => {
    isSyncing.planning = false;
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      const tab = data.tab;
      if (change.type === 'added' || change.type === 'modified') {
        const index = planningData.value[tab].findIndex((i: any) => i.id === change.doc.id);
        const newItem = { ...data, id: change.doc.id };
        if (index !== -1) {
          planningData.value[tab][index] = newItem;
        } else {
          planningData.value[tab].push(newItem);
        }
      } else if (change.type === 'removed') {
        planningData.value[tab] = planningData.value[tab].filter((i: any) => i.id !== change.doc.id);
      }
    });
  });
  unsubscribes.push(planningUnsub);

  // 4. Hotels Sync
  const hotelsUnsub = onSnapshot(collection(db, 'hotels'), (snapshot) => {
    isSyncing.hotels = false;
    console.log('Hotels snapshot received, docs:', snapshot.size);
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      console.log(`Hotel ${change.type}:`, change.doc.id, data.name);
      if (change.type === 'added' || change.type === 'modified') {
        const index = hotels.value.findIndex(h => h.id === change.doc.id);
        const newHotel = { ...data, id: change.doc.id } as HotelInfo;
        if (index !== -1) {
          hotels.value[index] = newHotel;
        } else {
          hotels.value.push(newHotel);
        }
      } else if (change.type === 'removed') {
        hotels.value = hotels.value.filter(h => h.id !== change.doc.id);
      }
    });
    // 確保排序一致，避免畫面跳動
    hotels.value.sort((a, b) => a.id.localeCompare(b.id));
  }, (error) => {
    console.error('Hotels sync error:', error);
    showToast('住宿資料同步失敗', 'error');
  });
  unsubscribes.push(hotelsUnsub);
};

onUnmounted(() => {
  unsubscribes.forEach(unsub => unsub());
});

// Watch for changes and save to localStorage
watch(allScheduleItems, (newVal) => {
  localStorage.setItem('okinawa_schedule', JSON.stringify(newVal));
}, { deep: true });

watch(mainTitle, (newVal) => {
  localStorage.setItem('okinawa_main_title', newVal);
});

watch(subTitle, (newVal) => {
  localStorage.setItem('okinawa_sub_title', newVal);
});

watch(hotels, (newVal) => {
  localStorage.setItem('okinawa_hotels', JSON.stringify(newVal));
}, { deep: true });

const showScrollTop = ref(false);
const handleScroll = () => {
  showScrollTop.value = window.scrollY > 300;
};

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

onMounted(() => {
  window.addEventListener('scroll', handleScroll);
});

const getTravelTime = (index: number) => {
  const items = scheduleItems.value;
  if (index >= items.length - 1) return null;
  
  const current = items[index];
  const next = items[index + 1];
  
  if (!current.time || !next.time) return null;
  
  const [h1, m1] = current.time.split(':').map(Number);
  const [h2, m2] = next.time.split(':').map(Number);
  
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff <= 0) return null;
  
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const openMap = (location: string, url?: string) => {
  if (url) {
    window.open(url, '_blank');
  } else {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank');
  }
};

const isDatePassed = (dateStr: string) => {
  if (!dateStr) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateStr);
  return today > targetDate;
};

const scheduleItems = computed(() => allScheduleItems[selectedDay.value] || []);

const countdown = computed(() => {
  const target = new Date('2026-09-25');
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

</script>

<template>
  <div class="min-h-screen pb-24">
    <!-- Login Overlay -->
    <div v-if="!userId" class="fixed inset-0 z-[300] bg-okinawa-blue/10 backdrop-blur-xl flex items-center justify-center p-6">
      <div class="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl text-center animate-in zoom-in duration-300">
        <div class="w-20 h-20 bg-okinawa-blue/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock class="w-10 h-10 text-okinawa-blue" />
        </div>
        <h2 class="text-2xl font-bold text-techo-ink mb-2">歡迎使用沖繩手帖</h2>
        <p class="text-techo-ink/60 mb-8">為了同步全家人的行程與記帳，請先登入您的 Google 帳號。</p>
        <button 
          @click="loginWithGoogle"
          class="w-full bg-white border-2 border-techo-ink/10 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-techo-ink/5 transition-colors shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5" />
          使用 Google 登入
        </button>
        <p class="text-[10px] text-techo-ink/40 mt-6 uppercase tracking-widest">Securely powered by Firebase</p>
      </div>
    </div>

    <!-- Header -->
    <header class="p-6 pt-12">
      <div class="flex justify-between items-end">
        <div class="flex-grow">
            <div v-if="isEditMode" class="space-y-2 pr-4">
              <div class="flex items-center gap-2">
                <input 
                  v-model="mainTitle" 
                  class="text-2xl font-bold text-okinawa-blue-dark bg-techo-ink/5 rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-okinawa-blue"
                >
                <button 
                  @click="resetDeclaration"
                  class="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors flex-shrink-0"
                  title="重置行前宣示"
                >
                  <RotateCcw class="w-4 h-4" />
                </button>
              </div>
              <div class="flex items-center gap-2">
              <Plane class="w-4 h-4 text-techo-ink/40" />
              <input 
                v-model="subTitle" 
                class="text-sm font-medium text-techo-ink/60 bg-techo-ink/5 rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-okinawa-blue"
              >
            </div>
          </div>
          <div v-else>
            <h1 class="text-3xl font-bold text-okinawa-blue-dark flex items-center gap-2">
              {{ mainTitle }}
            </h1>
            <div class="flex flex-col">
              <p class="text-techo-ink/60 mt-1 flex items-center gap-2">
                <Plane class="w-4 h-4" /> {{ subTitle }}
              </p>
              <button 
                @click="showDeclarationModal = true"
                class="text-[10px] font-bold text-okinawa-blue/60 hover:text-okinawa-blue flex items-center gap-1 mt-1 w-fit"
              >
                <CheckCircle2 class="w-3 h-3" />
                <span>行前宣示</span>
              </button>
            </div>
          </div>
        </div>
        <button 
          v-if="currentView === 'schedule'"
          @click="toggleEditMode"
          :class="['p-2 rounded-full transition-all flex-shrink-0', isEditMode ? 'bg-okinawa-blue text-white shadow-lg' : 'bg-techo-ink/5 text-techo-ink/40']"
        >
          <Edit2 class="w-5 h-5" />
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="px-6">
      <!-- Schedule View -->
      <div v-if="currentView === 'schedule'" class="space-y-6">
        <!-- Date Picker -->
        <div class="relative -mx-6">
          <div class="flex gap-4 overflow-x-auto px-6 pb-4 no-scrollbar flex-nowrap snap-x">
            <button 
              v-for="day in tripDays" 
              :key="day.date"
              @click="selectedDay = day.date"
              :class="[
                'flex-shrink-0 w-24 h-24 rounded-2xl flex flex-col items-center justify-center transition-all snap-center',
                selectedDay === day.date ? 'bg-okinawa-blue text-white shadow-lg scale-105' : 'bg-white text-techo-ink/40'
              ]"
            >
              <span class="text-xl font-bold leading-none">{{ day.dayNum }}</span>
              <span class="text-[11px] font-medium opacity-80 mt-0.5 leading-none">{{ day.date }}({{ day.day }})</span>
            </button>
          </div>
        </div>

        <!-- Weather Card -->
        <div class="techo-card p-5 bg-gradient-to-br from-white to-okinawa-blue/5">
          <div class="flex justify-between items-center mb-4">
            <div class="flex gap-2">
              <button 
                v-for="loc in locations" 
                :key="loc"
                @click="handleLocationChange(loc)"
                :class="[
                  'px-3 py-1 rounded-full text-xs font-bold transition-all',
                  weatherLocation === loc ? 'bg-okinawa-blue text-white shadow-sm' : 'bg-techo-ink/5 text-techo-ink/40'
                ]"
              >
                {{ loc }}
              </button>
            </div>
            <div v-if="isFetchingWeather" class="animate-spin text-okinawa-blue">
              <RefreshCw class="w-4 h-4" />
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="p-3 bg-okinawa-blue/10 rounded-2xl text-okinawa-blue">
                <Sun v-if="tripDays.find(d => d.date === selectedDay)?.weather === 'sun'" />
                <Cloud v-else-if="tripDays.find(d => d.date === selectedDay)?.weather === 'cloud'" />
                <CloudRain v-else />
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <p class="text-sm text-techo-ink/60">{{ weatherLocation }} 天氣預報</p>
                  <div v-if="!isWithinForecastRange()" class="flex items-center gap-1">
                    <Lock class="w-3 h-3 text-techo-ink/20" />
                    <span class="text-[9px] font-bold text-okinawa-blue/60">9/22 開啟更新</span>
                  </div>
                </div>
                <div class="flex items-baseline gap-2">
                  <span class="font-bold text-lg">{{ tripDays.find(d => d.date === selectedDay)?.temp }}</span>
                  <span class="text-xs text-techo-ink/40">
                    {{ tripDays.find(d => d.date === selectedDay)?.minTemp }} ~ {{ tripDays.find(d => d.date === selectedDay)?.maxTemp }}
                  </span>
                </div>
              </div>
            </div>
            <div class="text-right">
              <p class="text-xs text-techo-ink/40">降雨機率</p>
              <p class="font-bold text-okinawa-blue text-lg">{{ tripDays.find(d => d.date === selectedDay)?.rainProb }}</p>
            </div>
          </div>
        </div>

        <!-- Timeline -->
        <div class="space-y-0">
          <div v-for="(item, index) in scheduleItems" :key="index" class="flex gap-4">
            <!-- Left: Time & Line -->
            <div class="flex flex-col items-center w-16 flex-shrink-0">
              <!-- Time Badge -->
              <div class="bg-white px-2.5 py-1 rounded-lg shadow-sm border border-techo-ink/5 text-[11px] font-bold text-techo-ink/80 z-10">
                {{ item.time }}
              </div>
              
              <div v-if="index !== scheduleItems.length - 1" class="flex-grow border-l-2 border-dashed border-techo-ink/10 my-1 relative flex flex-col items-center">
                <!-- Small Dot -->
                <div class="w-2 h-2 bg-okinawa-blue/40 rounded-full absolute -top-1 -left-[5px]"></div>
                
                <!-- Travel Time Indicator (Automatic) -->
                <div v-if="getTravelTime(index)" class="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 bg-[#f0f4ff] px-3 py-1 rounded-full border border-okinawa-blue/10 shadow-sm z-10 flex items-center gap-1.5 whitespace-nowrap">
                  <Navigation class="w-3 h-3 text-okinawa-blue" />
                  <span class="text-[10px] font-bold text-okinawa-blue/80">{{ getTravelTime(index) }}</span>
                </div>
              </div>
              <div v-else class="h-6"></div>
            </div>

            <!-- Right: Detailed Card -->
            <div class="flex-grow pb-6">
              <div class="techo-card p-5 relative overflow-hidden group">
                <!-- Top Row: Title and Badge -->
                <div class="flex justify-between items-start gap-2 mb-2">
                  <h3 class="text-lg font-bold text-techo-ink">{{ item.title }}</h3>
                  <div :class="['px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap flex-shrink-0', item.color]">
                    {{ item.typeLabel }}
                  </div>
                </div>

                <!-- Middle: Note (Full Width) -->
                <p v-if="item.note" class="text-sm text-techo-ink/80 leading-relaxed font-medium mb-3 whitespace-pre-wrap w-full">{{ item.note }}</p>

                <!-- Bottom Row: Location and Controls -->
                <div class="flex justify-between items-end gap-2">
                  <!-- Location (Clickable Link) -->
                  <a 
                    v-if="item.location"
                    :href="item.type !== 'transport' && !item.title.includes('機場') ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}` : 'javascript:void(0)'"
                    target="_blank"
                    :class="[
                      'text-xs flex items-center gap-1 transition-colors py-1',
                      item.type !== 'transport' && !item.title.includes('機場') ? 'text-okinawa-blue hover:text-okinawa-blue-dark cursor-pointer' : 'text-techo-ink/40 cursor-default'
                    ]"
                    @click.stop="item.type === 'transport' || item.title.includes('機場') ? $event.preventDefault() : null"
                  >
                    <MapPin class="w-3.5 h-3.5" />
                    <span :class="item.type !== 'transport' && !item.title.includes('機場') ? 'underline decoration-dotted underline-offset-2' : ''">
                      {{ item.location }}
                    </span>
                  </a>
                  <div v-else class="flex-grow"></div>

                  <!-- Edit Controls -->
                  <div v-if="isEditMode" class="flex items-center gap-2 flex-shrink-0">
                    <button @click="moveItem(index, 'up')" class="p-1.5 bg-techo-ink/5 rounded-lg text-techo-ink/40 hover:text-okinawa-blue">
                      <ChevronUp class="w-4 h-4" />
                    </button>
                    <button @click="moveItem(index, 'down')" class="p-1.5 bg-techo-ink/5 rounded-lg text-techo-ink/40 hover:text-okinawa-blue">
                      <ChevronDown class="w-4 h-4" />
                    </button>
                    <button @click="editItem(item, index)" class="p-1.5 bg-okinawa-blue/10 rounded-lg text-okinawa-blue">
                      <Edit2 class="w-4 h-4" />
                    </button>
                    <button @click="deleteItem(index)" class="p-1.5 bg-red-50 rounded-lg text-red-500">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Add Item Button in Edit Mode -->
          <div v-if="isEditMode" class="pb-8">
            <button 
              @click="addNewItem"
              class="w-full py-4 border-2 border-dashed border-techo-ink/10 rounded-3xl flex items-center justify-center gap-2 text-techo-ink/40 hover:border-okinawa-blue hover:text-okinawa-blue transition-all"
            >
              <Plus class="w-5 h-5" />
              <span class="font-bold">新增行程項目</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Bookings View -->
      <div v-if="currentView === 'bookings'" class="space-y-6">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-bold">預訂憑證</h2>
        </div>

        <!-- Booking Categories -->
        <div class="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          <button 
            v-for="cat in bookingCategories" 
            :key="cat.id"
            @click="bookingCategory = cat.id"
            :class="[
              'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap',
              bookingCategory === cat.id ? 'bg-okinawa-blue text-white shadow-md' : 'bg-techo-ink/5 text-techo-ink/40 hover:bg-techo-ink/10'
            ]"
          >
            <component :is="cat.icon" class="w-4 h-4" />
            {{ cat.label }}
          </button>
        </div>
        
        <!-- Flight Section -->
        <div v-if="bookingCategory === 'flight'" class="space-y-4">
          <div class="flex items-center gap-2 text-xs font-bold text-techo-ink/40 uppercase tracking-widest pl-1">
            <Plane class="w-3 h-3" />
            <span>機票航班</span>
          </div>
          <!-- Flight Card 1: Departure -->
          <div 
            @click="selectedFlightCode = 'IT232'"
            class="bg-okinawa-blue rounded-techo p-6 text-white shadow-lg relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div class="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            <div class="flex justify-between items-center mb-6">
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <Plane class="w-5 h-5" />
                  <span class="font-bold tracking-widest">IT232</span>
                </div>
                <span class="text-[10px] opacity-80 mt-1">Tigerair Taiwan 台灣虎航</span>
              </div>
              <span class="text-xs bg-white/20 px-2 py-1 rounded">ECONOMY</span>
            </div>
            <div class="flex justify-between items-center">
              <div>
                <p class="text-3xl font-bold">TPE</p>
                <p class="text-xs opacity-80">Taipei</p>
              </div>
              <div class="flex-grow flex flex-col items-center px-4">
                <div class="w-full border-t border-dashed border-white/40 relative">
                  <Plane class="w-4 h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" />
                </div>
                <span class="text-[10px] mt-2 opacity-60">1h 30m</span>
              </div>
              <div class="text-right">
                <p class="text-3xl font-bold">OKA</p>
                <p class="text-xs opacity-80">Okinawa</p>
              </div>
            </div>
            <div class="mt-6 pt-6 border-t border-white/20 flex justify-between text-sm">
              <div>
                <p class="opacity-60 text-xs">DATE</p>
                <p class="font-bold">2026-09-25</p>
              </div>
              <div>
                <p class="opacity-60 text-xs">GATE</p>
                <p class="font-bold">A4</p>
              </div>
              <div>
                <p class="opacity-60 text-xs">SEAT</p>
                <p class="font-bold">多位</p>
              </div>
            </div>
          </div>

          <!-- Flight Card 2: Return -->
          <div 
            @click="selectedFlightCode = 'FD 231'"
            class="bg-emerald-green rounded-techo p-6 text-white shadow-lg relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div class="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            <div class="flex justify-between items-center mb-6">
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <Plane class="w-5 h-5" />
                  <span class="font-bold tracking-widest">FD 231</span>
                </div>
                <span class="text-[10px] opacity-80 mt-1">Thai AirAsia 泰國亞航</span>
              </div>
              <span class="text-xs bg-white/20 px-2 py-1 rounded">ECONOMY</span>
            </div>
            <div class="flex justify-between items-center">
              <div>
                <p class="text-3xl font-bold">OKA</p>
                <p class="text-xs opacity-80">Okinawa</p>
              </div>
              <div class="flex-grow flex flex-col items-center px-4">
                <div class="w-full border-t border-dashed border-white/40 relative">
                  <Plane class="w-4 h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" />
                </div>
                <span class="text-[10px] mt-2 opacity-60">1h 35m</span>
              </div>
              <div class="text-right">
                <p class="text-3xl font-bold">TPE</p>
                <p class="text-xs opacity-80">Taipei</p>
              </div>
            </div>
            <div class="mt-6 pt-6 border-t border-white/20 flex justify-between text-sm">
              <div>
                <p class="opacity-60 text-xs">DATE</p>
                <p class="font-bold">2026-09-29</p>
              </div>
              <div>
                <p class="opacity-60 text-xs">GATE</p>
                <p class="font-bold">41</p>
              </div>
              <div>
                <p class="opacity-60 text-xs">SEAT</p>
                <p class="font-bold">多位</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Accommodation Section -->
        <div v-if="bookingCategory === 'stay'" class="space-y-4">
          <div class="flex items-center justify-between pl-1">
            <div class="flex items-center gap-2 text-xs font-bold text-techo-ink/40 uppercase tracking-widest">
              <Hotel class="w-3 h-3" />
              <span>住宿預訂</span>
            </div>
            <div class="flex items-center gap-2">
              <button 
                @click="migrateAndSync(); setupRealtimeListeners();" 
                class="p-1.5 hover:bg-techo-ink/5 rounded-full transition-colors text-techo-ink/40"
                title="重新整理資料"
              >
                <RotateCcw class="w-3.5 h-3.5" />
              </button>
              <div v-if="isSyncing.hotels" class="flex items-center gap-1 text-[10px] text-okinawa-blue animate-pulse">
                <RefreshCw class="w-3 h-3 animate-spin" />
                <span>同步中...</span>
              </div>
            </div>
          </div>
          
          <div v-if="hotels.length === 0" class="techo-card p-10 text-center opacity-40">
            <Hotel class="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>尚無住宿資料</p>
          </div>

          <div v-for="hotel in hotels" :key="hotel.id" class="techo-card overflow-hidden cursor-pointer active:scale-[0.98] transition-transform relative group">
            <img :src="hotel.images[0]" class="w-full h-40 object-cover" referrerPolicy="no-referrer" crossorigin="anonymous" @click="!isEditMode && openHotelModal(hotel)" />
            
            <!-- Upload Overlay in Edit Mode -->
            <div v-if="isEditMode" class="absolute top-0 left-0 w-full h-40 bg-black/60 flex flex-col items-center justify-center gap-3 transition-opacity p-4" :class="isEditMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'">
              <div class="flex flex-wrap justify-center gap-2 mb-2 max-h-24 overflow-y-auto p-2">
                <div v-for="(img, idx) in hotel.images" :key="idx" class="relative w-10 h-10 rounded-lg overflow-hidden border border-white/20">
                  <img :src="img" class="w-full h-full object-cover" referrerPolicy="no-referrer" crossorigin="anonymous" />
                  <button @click.stop="removeHotelImage(hotel.id, idx)" class="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg">
                    <X class="w-3 h-3" />
                  </button>
                </div>
              </div>
              <button 
                @click.stop="triggerHotelImageUpload(hotel.id)"
                class="bg-white text-okinawa-blue px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg"
              >
                <Plus class="w-4 h-4" /> 新增圖片
              </button>
              <input 
                :id="`hotel-image-input-${hotel.id}`" 
                type="file" 
                accept="image/*" 
                multiple
                class="hidden" 
                @change="handleHotelImageUpload($event, hotel.id)" 
              />
            </div>

            <div class="p-4" @click="!isEditMode && openHotelModal(hotel)">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="font-bold text-lg">{{ hotel.name }}</h3>
                  <p class="text-xs text-techo-ink/40 mt-1">{{ hotel.nameEn }}</p>
                </div>
                <div class="bg-emerald-green/10 text-emerald-green px-2 py-1 rounded text-xs font-bold">已預訂</div>
              </div>
              <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p class="text-xs text-techo-ink/40">入住 (Check-in)</p>
                  <p class="font-medium leading-tight mt-1">{{ hotel.checkInDate.split(' (')[0] }}<br/>{{ hotel.checkInTime }}</p>
                </div>
                <div>
                  <p class="text-xs text-techo-ink/40">退房 (Check-out)</p>
                  <p class="font-medium leading-tight mt-1">{{ hotel.checkOutDate.split(' (')[0] }}<br/>{{ hotel.checkOutTime }}</p>
                </div>
              </div>
              <div class="mt-4 pt-4 border-t border-techo-ink/5 flex justify-between items-center">
                <span class="text-xs text-techo-ink/40">行程編號：{{ hotel.bookingId }}</span>
                <span class="text-xs font-bold text-okinawa-blue">查看詳情</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Car Rental Section -->
        <div v-if="bookingCategory === 'car'" class="space-y-4">
          <div class="flex items-center gap-2 text-xs font-bold text-techo-ink/40 uppercase tracking-widest pl-1">
            <Car class="w-3 h-3" />
            <span>租車預約</span>
          </div>
          <div class="techo-card overflow-hidden">
            <div class="p-4 bg-okinawa-blue/5 border-b border-techo-ink/5 flex items-center gap-4">
              <div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-okinawa-blue shadow-sm">
                <Car class="w-6 h-6" />
              </div>
              <div>
                <h3 class="font-bold">ORIX 租車公司</h3>
                <p class="text-[10px] text-techo-ink/40 uppercase font-bold tracking-wider">X-TRAIL 同等級 (RD) | 禁煙車</p>
              </div>
            </div>
            
            <div class="p-4 space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-techo-ink/5 p-3 rounded-2xl">
                  <p class="text-[10px] font-bold text-techo-ink/40 uppercase mb-1">取車 (Pick-up)</p>
                  <p class="text-sm font-bold">2026-09-27</p>
                  <p class="text-xs text-techo-ink/60">08:00</p>
                  <p 
                    class="text-[10px] mt-2 text-okinawa-blue font-medium leading-tight flex items-center gap-1 cursor-pointer hover:underline"
                    @click="openMap('沖繩縣那霸市牧志2-17-10')"
                  >
                    <MapPin class="w-3 h-3" />
                    美榮橋站前 外語櫃檯
                  </p>
                </div>
                <div class="bg-techo-ink/5 p-3 rounded-2xl">
                  <p class="text-[10px] font-bold text-techo-ink/40 uppercase mb-1">還車 (Drop-off)</p>
                  <p class="text-sm font-bold">2026-09-29</p>
                  <p class="text-xs text-techo-ink/60">14:00</p>
                  <p 
                    class="text-[10px] mt-2 text-okinawa-blue font-medium leading-tight flex items-center gap-1 cursor-pointer hover:underline"
                    @click="openMap('沖繩縣豐見城市豐崎1-1174')"
                  >
                    <MapPin class="w-3 h-3" />
                    那霸機場 外語櫃檯
                  </p>
                </div>
              </div>

              <div class="space-y-2 pt-2">
                <div class="flex justify-between text-xs">
                  <span class="text-techo-ink/40">租車方案</span>
                  <span class="font-medium">安心方案 (RAP)</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-techo-ink/40">附加項目</span>
                  <span class="font-medium">ETC 裝置</span>
                </div>
                <div class="flex justify-between items-center pt-2 border-t border-techo-ink/5">
                  <span class="text-xs font-bold">總費用</span>
                  <span class="text-lg font-bold text-okinawa-blue">¥25,980</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tickets Section -->
        <div v-if="bookingCategory === 'ticket'" class="space-y-6">
          <div class="flex items-center gap-2 text-xs font-bold text-techo-ink/40 uppercase tracking-widest pl-1">
            <Ticket class="w-3 h-3" />
            <span>票券憑證</span>
          </div>
          
          <!-- eSIM Section -->
          <div class="space-y-4">
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-2">
                <QrCode class="w-4 h-4 text-okinawa-blue" />
                <span class="text-sm font-bold">eSIM QR 碼 (4人)</span>
              </div>
              <span class="text-[10px] text-techo-ink/40 font-bold uppercase tracking-wider">點擊上傳憑證</span>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div v-for="(esim, idx) in esims" :key="idx" class="techo-card overflow-hidden aspect-square relative group">
                <div v-if="!esim" @click="triggerEsimUpload(idx)" class="w-full h-full flex flex-col items-center justify-center gap-2 bg-techo-ink/5 cursor-pointer hover:bg-techo-ink/10 transition-colors">
                  <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center text-techo-ink/20 shadow-sm">
                    <Upload class="w-5 h-5" />
                  </div>
                  <span class="text-[10px] font-bold text-techo-ink/40 uppercase">{{ esimMembers[idx] }}</span>
                </div>
                
                <template v-else>
                  <img :src="esim" class="w-full h-full object-contain p-2" />
                  <!-- Delete Button (Always visible for better mobile access) -->
                  <button 
                    @click="removeEsim(idx)" 
                    class="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg active:scale-90 transition-transform z-10"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                  <!-- Edit Button (Always visible) -->
                  <button 
                    @click="triggerEsimUpload(idx)" 
                    class="absolute top-2 left-2 p-1.5 bg-white text-techo-ink rounded-full shadow-lg active:scale-90 transition-transform z-10"
                  >
                    <Edit2 class="w-3.5 h-3.5" />
                  </button>
                  
                  <div class="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 py-0.5 rounded-full text-[10px] font-bold text-techo-ink/60 shadow-sm">
                    {{ esimMembers[idx] }}
                  </div>
                </template>

                <input 
                  :id="`esim-input-${idx}`" 
                  type="file" 
                  accept="image/*" 
                  class="hidden" 
                  @change="handleEsimUpload($event, idx)" 
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Expense View -->
      <div v-if="currentView === 'expense'" class="space-y-6">
        <!-- Sub Navigation -->
        <div class="flex p-1 bg-techo-ink/5 rounded-2xl">
          <button 
            @click="expenseSubView = 'input'"
            :class="[
              'flex-grow py-3 rounded-xl font-bold text-sm transition-all',
              expenseSubView === 'input' ? 'bg-white text-okinawa-blue shadow-sm' : 'text-techo-ink/40'
            ]"
          >
            記帳
          </button>
          <button 
            @click="expenseSubView = 'details'"
            :class="[
              'flex-grow py-3 rounded-xl font-bold text-sm transition-all',
              expenseSubView === 'details' ? 'bg-white text-okinawa-blue shadow-sm' : 'text-techo-ink/40'
            ]"
          >
            明細
          </button>
        </div>

        <!-- Input View -->
        <div v-if="expenseSubView === 'input'" class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <!-- Exchange Rate Only -->
          <div class="bg-gradient-to-br from-okinawa-blue to-emerald-green p-6 rounded-[32px] text-white shadow-xl relative overflow-hidden">
            <div class="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div class="flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <RefreshCw v-if="isExchangeUpdateAllowed" class="w-4 h-4 opacity-60 animate-spin-slow" />
                  <Lock v-else class="w-4 h-4 opacity-60" />
                  <p class="text-xs font-bold uppercase tracking-widest opacity-60">
                    {{ isExchangeUpdateAllowed ? '即時匯率' : '預設匯率 (出發前3天開啟更新)' }}
                  </p>
                </div>
                <p class="text-2xl font-bold">1 JPY = {{ exchangeRates['JPY'].toFixed(3) }} TWD</p>
              </div>
              <div class="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                <Coins class="w-6 h-6" />
              </div>
            </div>
          </div>

          <!-- Input Form -->
          <div class="techo-card p-6 space-y-6">
            <!-- Date -->
            <div class="space-y-2">
              <p class="text-[10px] font-bold text-techo-ink/40 uppercase tracking-widest">日期</p>
              <div class="relative">
                <input 
                  v-model="expenseForm.date" 
                  type="date" 
                  class="w-full p-4 bg-techo-ink/5 rounded-2xl font-bold text-techo-ink focus:outline-none focus:ring-2 focus:ring-okinawa-blue appearance-none"
                  style="color-scheme: light;"
                >
                <Calendar class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-techo-ink/20 pointer-events-none" />
              </div>
            </div>

            <!-- Currency -->
            <div class="space-y-2">
              <p class="text-[10px] font-bold text-techo-ink/40 uppercase tracking-widest">幣別</p>
              <div class="grid grid-cols-2 gap-3">
                <button 
                  v-for="curr in ['JPY', 'TWD']" 
                  :key="curr"
                  @click="expenseForm.currency = curr"
                  :class="[
                    'py-3 rounded-xl font-bold border-2 transition-all',
                    expenseForm.currency === curr ? 'bg-okinawa-blue/5 border-okinawa-blue text-okinawa-blue' : 'bg-white border-techo-ink/5 text-techo-ink/40'
                  ]"
                >
                  {{ curr }}
                </button>
              </div>
            </div>

            <!-- Amount -->
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <p class="text-[10px] font-bold text-techo-ink/40 uppercase tracking-widest text-red-500">* 金額</p>
                <input 
                  v-model.number="expenseForm.amount" 
                  type="number" 
                  class="w-full p-4 bg-techo-ink/5 rounded-2xl font-bold text-xl focus:outline-none focus:ring-2 focus:ring-okinawa-blue"
                  placeholder="0"
                >
              </div>
              <div class="space-y-2">
                <p class="text-[10px] font-bold text-techo-ink/40 uppercase tracking-widest">約合台幣</p>
                <div class="w-full p-4 bg-techo-ink/5 rounded-2xl font-bold text-xl text-techo-ink/40">
                  {{ expenseForm.twdAmount }}
                </div>
              </div>
            </div>

            <!-- Payment Method -->
            <div class="space-y-2">
              <p class="text-[10px] font-bold text-techo-ink/40 uppercase tracking-widest">支付方式</p>
              <div class="grid grid-cols-3 gap-2">
                <button 
                  v-for="method in ['現金', '信用卡', '行動支付']" 
                  :key="method"
                  @click="expenseForm.paymentMethod = method"
                  :class="[
                    'py-2.5 rounded-xl text-xs font-bold border-2 transition-all',
                    expenseForm.paymentMethod === method ? 'bg-orange-50 border-orange-400 text-orange-700' : 'bg-white border-techo-ink/5 text-techo-ink/40'
                  ]"
                >
                  {{ method }}
                </button>
              </div>
            </div>

            <!-- Location & Item -->
            <div class="space-y-4">
              <div class="space-y-2">
                <p class="text-[10px] font-bold text-techo-ink/40 uppercase tracking-widest">地點 (選填)</p>
                <input 
                  v-model="expenseForm.location" 
                  type="text" 
                  class="w-full p-4 bg-techo-ink/5 rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-okinawa-blue"
                  placeholder="例如：便利商店"
                >
              </div>
              <div class="space-y-2">
                <p class="text-[10px] font-bold text-techo-ink/40 uppercase tracking-widest text-red-500">* 消費項目</p>
                <input 
                  v-model="expenseForm.item" 
                  type="text" 
                  class="w-full p-4 bg-techo-ink/5 rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-okinawa-blue"
                  placeholder="例如：午餐"
                >
              </div>
            </div>

            <!-- Payer -->
            <div class="space-y-2">
              <p class="text-[10px] font-bold text-techo-ink/40 uppercase tracking-widest">付款人</p>
              <div class="grid grid-cols-4 gap-2">
                <button 
                  v-for="name in ['德', '媽', '爸', '珊']" 
                  :key="name"
                  @click="expenseForm.payer = name"
                  :class="[
                    'py-2.5 rounded-xl text-xs font-bold border-2 transition-all',
                    expenseForm.payer === name ? 'bg-okinawa-blue text-white border-okinawa-blue' : 'bg-white border-techo-ink/5 text-techo-ink/40'
                  ]"
                >
                  {{ name }}
                </button>
              </div>
            </div>

            <div class="flex gap-3 mt-4">
              <button 
                v-if="editingExpenseId"
                @click="cancelEdit"
                class="flex-grow py-4 bg-techo-ink/5 text-techo-ink/40 rounded-2xl font-bold active:scale-95 transition-transform"
              >
                取消編輯
              </button>
              <button 
                @click="saveExpense"
                class="flex-grow py-4 bg-okinawa-blue text-white rounded-2xl font-bold shadow-lg shadow-okinawa-blue/20 active:scale-95 transition-transform"
              >
                {{ editingExpenseId ? '更新紀錄' : '記一筆' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Details View -->
        <div v-else class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <!-- Total Summary (Simplified to TWD only) -->
          <div class="bg-gradient-to-br from-okinawa-blue to-emerald-green p-6 rounded-[24px] text-white shadow-lg relative overflow-hidden">
            <div class="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            <div class="flex flex-col items-center text-center">
              <p class="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">總支出累計 (台幣)</p>
              <p class="text-4xl font-bold">NT$ {{ totalTwd.toLocaleString() }}</p>
              <div class="mt-2 flex items-center gap-2 opacity-40">
                <div class="h-[1px] w-8 bg-white"></div>
                <p class="text-[10px] font-bold">約合 ¥{{ Math.round(totalJpy).toLocaleString() }}</p>
                <div class="h-[1px] w-8 bg-white"></div>
              </div>
            </div>
          </div>

          <div v-if="expenses.length === 0" class="text-center py-20 text-techo-ink/20">
            <Wallet class="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p class="font-bold text-lg">尚無支出紀錄</p>
            <button @click="expenseSubView = 'input'" class="mt-4 text-okinawa-blue font-bold text-sm">前往記帳</button>
          </div>
          
          <div v-for="group in groupedExpenses" :key="group.date" class="space-y-3">
            <div class="flex justify-between items-end px-2">
              <h3 class="font-bold text-techo-ink text-sm">{{ formatDateDisplay(group.date) }}</h3>
              <p class="text-[10px] font-bold text-techo-ink/40 uppercase">當日小計: <span class="text-okinawa-blue">NT$ {{ group.totalTwd.toLocaleString() }}</span></p>
            </div>
            
            <div v-for="expense in group.items" :key="expense.id" class="techo-card p-4 flex justify-between items-center group">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-okinawa-blue/10 rounded-full flex items-center justify-center text-okinawa-blue">
                  <Banknote v-if="expense.paymentMethod === '現金'" class="w-5 h-5" />
                  <CreditCard v-else-if="expense.paymentMethod === '信用卡'" class="w-5 h-5" />
                  <Smartphone v-else class="w-5 h-5" />
                </div>
                <div>
                  <p class="font-bold text-techo-ink">{{ expense.item }}</p>
                  <p class="text-[10px] text-techo-ink/40 font-bold uppercase">
                    {{ expense.paymentMethod }} ({{ expense.payer }})
                    <span v-if="expense.location"> • {{ expense.location }}</span>
                  </p>
                </div>
              </div>
              <div class="text-right flex items-center gap-3">
                <div>
                  <p class="font-bold text-techo-ink">{{ expense.currency === 'JPY' ? '¥' : 'NT$' }}{{ expense.amount.toLocaleString() }}</p>
                  <p class="text-[10px] text-techo-ink/40 font-bold">≈ NT$ {{ expense.twdAmount.toLocaleString() }}</p>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="editExpense(expense)" class="p-2 text-okinawa-blue hover:bg-okinawa-blue/5 rounded-full">
                    <Edit2 class="w-4 h-4" />
                  </button>
                  <button @click="deleteExpense(expense.id)" class="p-2 text-red-500 hover:bg-red-50 rounded-full">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Planning View -->
      <div v-if="currentView === 'planning'" class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div class="flex items-center justify-between">
          <div class="flex gap-2 overflow-x-auto no-scrollbar">
            <button 
              v-for="tab in [
                { id: 'todo', label: '待辦清單' },
                { id: 'packing', label: '行李清單' },
                { id: 'shopping', label: '購物清單' }
              ]"
              :key="tab.id"
              @click="planningTab = tab.id"
              :class="[
                'px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap',
                planningTab === tab.id ? 'bg-okinawa-blue text-white shadow-lg scale-105' : 'bg-white text-techo-ink/40'
              ]"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>

        <!-- Independent Progress Bar -->
        <div class="bg-white rounded-3xl p-5 shadow-sm border border-techo-ink/5 animate-in fade-in slide-in-from-top-4 duration-500 w-full">
          <div class="flex justify-between items-start mb-3">
            <h3 class="text-sm font-bold text-techo-ink">{{ 
              planningTab === 'todo' ? '待辦準備進度' : 
              planningTab === 'packing' ? '行李準備進度' : '購物準備進度' 
            }}</h3>
            <span class="text-2xl font-black text-okinawa-blue">{{ planningProgress[planningTab].percent }}%</span>
          </div>
          
          <div class="w-full h-2 bg-techo-ink/5 rounded-full overflow-hidden mb-2">
            <div 
              class="h-full bg-okinawa-blue transition-all duration-1000 ease-out rounded-full"
              :style="{ width: `${planningProgress[planningTab].percent}%` }"
            ></div>
          </div>
          
          <div class="flex justify-end">
            <p class="text-[10px] text-techo-ink/40 font-bold">
              已完成 {{ planningProgress[planningTab].completed }} / {{ planningProgress[planningTab].total }} 項
            </p>
          </div>
        </div>

        <!-- Add Item & Filter -->
        <div class="space-y-3">
          <!-- Member Filter (Acts as both filter and category for new items) -->
          <div v-if="planningTab !== 'todo'" class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <p class="text-[10px] font-bold text-techo-ink/40 uppercase whitespace-nowrap">成員：</p>
            <button 
              v-for="m in ['全體', '德', '媽', '爸', '珊']" 
              :key="m"
              @click="planningFilterMember = m"
              :class="[
                'px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap',
                planningFilterMember === m ? 'bg-techo-ink text-white' : 'bg-white text-techo-ink/40 border border-techo-ink/5'
              ]"
            >
              {{ m }}
            </button>
          </div>

          <!-- Bag Type Filter for Packing -->
          <div v-if="planningTab === 'packing'" class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <p class="text-[10px] font-bold text-techo-ink/40 uppercase whitespace-nowrap">行李分類：</p>
            <button 
              v-for="b in ['隨身小包', '後背包', '行李箱']" 
              :key="b"
              @click="selectedBagType = b"
              :class="[
                'px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap',
                selectedBagType === b ? 'bg-okinawa-blue text-white shadow-md' : 'bg-okinawa-blue/10 text-okinawa-blue'
              ]"
            >
              {{ b }}
            </button>
          </div>

          <div class="flex gap-2">
            <input 
              v-model="newItemText"
              type="text" 
              class="flex-grow p-4 bg-white rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-okinawa-blue shadow-sm transition-all"
              :placeholder="`新增${planningTab === 'todo' ? '待辦' : planningTab === 'packing' ? '行李' : '購物'}項目...`"
              @keyup.enter="addPlanningItem"
            >
            <button 
              @click="addPlanningItem"
              class="p-4 bg-okinawa-blue text-white rounded-2xl shadow-lg active:scale-95 transition-all"
            >
              <Plus class="w-6 h-6" />
            </button>
          </div>
        </div>

        <div class="space-y-6">
          <div v-for="(items, groupName) in filteredPlanningData" :key="groupName" class="space-y-3">
            <div v-if="planningTab === 'packing' || (planningTab === 'shopping' && planningFilterMember === '全體')" class="flex items-center gap-2 px-2">
              <div class="w-1 h-4 bg-okinawa-blue rounded-full"></div>
              <h3 class="font-bold text-sm text-techo-ink/60">{{ groupName }}</h3>
            </div>
            
            <div 
              v-for="item in items" 
              :key="item.id" 
              class="techo-card p-4 flex items-center gap-4 group cursor-pointer"
              @click="togglePlanningItem(item)"
            >
              <div class="text-okinawa-blue">
                <CheckCircle2 v-if="item.completed" class="w-6 h-6" />
                <Circle v-else class="w-6 h-6 text-techo-ink/20" />
              </div>
              <div class="flex-grow">
                <input 
                  v-if="editingPlanningId === item.id"
                  v-model="editingPlanningText"
                  @click.stop
                  @keyup.enter="saveEditPlanning(item)"
                  @blur="saveEditPlanning(item)"
                  class="w-full bg-techo-ink/5 p-1 rounded font-medium focus:outline-none"
                  autoFocus
                >
                <p v-else :class="['font-medium transition-all', item.completed ? 'line-through text-techo-ink/30' : 'text-techo-ink']">
                  {{ item.text }}
                  <span v-if="item.completed && item.completedBy" class="ml-2 text-[10px] font-bold bg-okinawa-blue/10 text-okinawa-blue px-1.5 py-0.5 rounded-md no-underline inline-block">
                    {{ item.completedBy }}
                  </span>
                </p>
              </div>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  @click.stop="handleEditToggle(item)"
                  :class="[
                    'p-2 rounded-full transition-colors',
                    editingPlanningId === item.id ? 'bg-okinawa-blue text-white' : 'text-okinawa-blue hover:bg-okinawa-blue/5'
                  ]"
                >
                  <Check v-if="editingPlanningId === item.id" class="w-4 h-4" />
                  <Edit2 v-else class="w-4 h-4" />
                </button>
                <button 
                  @click.stop="confirmDeletePlanning(item.id)"
                  :class="[
                    'px-2 py-1 rounded-full text-[10px] font-bold transition-all',
                    confirmingDeleteId === item.id ? 'bg-red-500 text-white' : 'text-red-400 hover:bg-red-50'
                  ]"
                >
                  <span v-if="confirmingDeleteId === item.id">確定？</span>
                  <Trash2 v-else class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div v-if="Object.keys(filteredPlanningData).length === 0 || planningData[planningTab].length === 0" class="text-center py-20 text-techo-ink/20">
            <ClipboardList class="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p class="font-bold">清單空空如也</p>
          </div>
        </div>
      </div>

      <!-- Tools View -->
      <div v-if="currentView === 'tools'" class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <!-- Main Tools Menu -->
        <div v-if="toolSubView === 'main'" class="space-y-4">
          <!-- Google Translate Button -->
          <a 
            href="https://translate.google.com/?sl=zh-TW&tl=ja&op=translate" 
            target="_blank"
            class="flex items-center justify-center gap-3 w-full py-4 bg-okinawa-blue text-white rounded-2xl font-bold shadow-lg shadow-okinawa-blue/20 active:scale-95 transition-transform"
          >
            <Languages class="w-5 h-5" />
            打開 Google 翻譯
          </a>

          <!-- Gemini Button -->
          <a 
            href="https://gemini.google.com/" 
            target="_blank"
            class="flex items-center justify-center gap-3 w-full py-4 bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570] text-white rounded-2xl font-bold shadow-lg shadow-purple-500/20 active:scale-95 transition-transform"
          >
            <Sparkles class="w-5 h-5" />
            打開 Gemini AI
          </a>

          <!-- Compact Exchange Calculator -->
          <div class="techo-card p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Banknote class="w-5 h-5 text-techo-ink/60" />
                <h3 class="font-bold text-base">匯率試算</h3>
              </div>
              <div class="flex flex-col items-end gap-1">
                <div class="px-3 py-1 bg-techo-ink/5 rounded-full flex items-center gap-1.5">
                  <Lock v-if="!isExchangeUpdateAllowed" class="w-3 h-3 text-techo-ink/30" />
                  <span class="text-[10px] font-bold text-techo-ink/40 uppercase tracking-wider">匯率：</span>
                  <span class="text-xs font-mono font-bold text-techo-ink/60">{{ toolExchangeRate.toFixed(3) }}</span>
                </div>
                <p v-if="!isExchangeUpdateAllowed" class="text-[9px] font-bold text-okinawa-blue/60">
                  出發前3天(9/22)開啟自動更新
                </p>
              </div>
            </div>

            <div class="grid grid-cols-[1fr,auto,1fr] items-center gap-3">
              <div class="relative">
                <p class="absolute -top-2 left-3 px-1 bg-white text-[9px] font-bold text-techo-ink/30 uppercase tracking-widest">日幣 JPY</p>
                <input 
                  v-model="toolJpyAmount"
                  type="number" 
                  placeholder="輸入金額"
                  class="w-full p-3 bg-white border border-techo-ink/10 rounded-xl text-center font-bold focus:outline-none focus:ring-2 focus:ring-okinawa-blue"
                >
              </div>
              <div class="text-techo-ink/20 font-bold">=</div>
              <div class="relative">
                <p class="absolute -top-2 left-3 px-1 bg-[#fffbf5] text-[9px] font-bold text-orange-700/30 uppercase tracking-widest">台幣 TWD</p>
                <div class="w-full p-3 bg-[#fffbf5] rounded-xl text-center font-bold text-orange-700 border border-orange-100 min-h-[48px] flex items-center justify-center">
                  {{ toolTwdAmount.toLocaleString() }}
                </div>
              </div>
            </div>
          </div>

          <!-- Travel Phrases Entry -->
          <div 
            @click="toolSubView = 'phrases'"
            class="techo-card p-5 flex items-center justify-between group cursor-pointer active:scale-[0.98] transition-all"
          >
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center shadow-sm">
                <MessageSquare class="w-6 h-6" />
              </div>
              <div>
                <h3 class="font-bold text-lg">常用旅遊會話</h3>
                <p class="text-xs text-techo-ink/40">購物、點餐、問路...</p>
              </div>
            </div>
            <ChevronRight class="w-5 h-5 text-techo-ink/20 group-hover:translate-x-1 transition-transform" />
          </div>

          <!-- Emergency Info Entry -->
          <div 
            @click="toolSubView = 'emergency'"
            class="techo-card p-5 flex items-center justify-between group cursor-pointer active:scale-[0.98] transition-all"
          >
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shadow-sm">
                <ShieldAlert class="w-6 h-6" />
              </div>
              <div>
                <h3 class="font-bold text-lg">緊急救援資訊</h3>
                <p class="text-xs text-techo-ink/40">報警、救護車、辦事處</p>
              </div>
            </div>
            <ChevronRight class="w-5 h-5 text-techo-ink/20 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <!-- Phrases Sub-page -->
        <div v-if="toolSubView === 'phrases'" class="space-y-6 animate-in slide-in-from-right duration-300">
          <button @click="toolSubView = 'main'" class="flex items-center gap-2 text-techo-ink/60 font-bold hover:text-okinawa-blue transition-colors">
            <ArrowLeft class="w-5 h-5" />
            返回工具
          </button>

          <div class="bg-[#fffbf5] p-6 rounded-[32px] border border-orange-100 flex items-center gap-4">
            <div class="text-3xl">🗣️</div>
            <div>
              <h2 class="text-xl font-bold text-orange-900">日語旅遊會話</h2>
              <p class="text-xs text-orange-700/60 font-medium">點擊卡片即可播放日語發音 🔊</p>
            </div>
          </div>

          <div v-for="cat in travelPhraseCategories" :key="cat.id" class="space-y-3">
            <div class="flex items-center gap-2 px-2">
              <span class="text-lg">{{ cat.icon }}</span>
              <h3 class="font-bold text-sm text-techo-ink/60">{{ cat.label }}</h3>
            </div>
            <div class="bg-white rounded-[24px] shadow-sm border border-techo-ink/5 overflow-hidden divide-y divide-techo-ink/5">
              <div 
                v-for="phrase in cat.phrases" 
                :key="phrase.jp"
                @click="speak(phrase.jp)"
                class="p-5 active:bg-techo-ink/5 transition-colors cursor-pointer flex justify-between items-center group"
              >
                <div class="space-y-1">
                  <p class="text-xl font-bold text-techo-ink">{{ phrase.jp }}</p>
                  <p class="text-sm font-bold text-orange-600/60">{{ phrase.ro }}</p>
                  <p class="text-sm text-techo-ink/40">{{ phrase.cn }}</p>
                </div>
                <div class="p-2 bg-techo-ink/5 rounded-full opacity-40 group-hover:opacity-100 group-hover:bg-okinawa-blue/10 group-hover:text-okinawa-blue transition-all">
                  <Volume2 class="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Emergency Sub-page -->
        <div v-if="toolSubView === 'emergency'" class="space-y-6 animate-in slide-in-from-right duration-300">
          <button @click="toolSubView = 'main'" class="flex items-center gap-2 text-techo-ink/60 font-bold hover:text-okinawa-blue transition-colors">
            <ArrowLeft class="w-5 h-5" />
            返回工具
          </button>

          <div class="space-y-3">
            <a 
              v-for="contact in emergencyContacts" 
              :key="contact.value"
              :href="`tel:${contact.value}`"
              class="techo-card p-5 flex items-center gap-4 active:scale-[0.98] transition-all"
            >
              <div :class="['w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm', contact.bg, contact.color]">
                <component :is="contact.icon" class="w-6 h-6" />
              </div>
              <div class="flex-grow">
                <h3 class="font-bold text-sm text-techo-ink/60">{{ contact.label }}</h3>
                <p :class="['text-xl font-mono font-bold', contact.color]">{{ contact.value }}</p>
                <p v-if="contact.sub" class="text-[10px] text-techo-ink/40 mt-0.5">{{ contact.sub }}</p>
              </div>
              <PhoneCall class="w-5 h-5 text-techo-ink/20" />
            </a>
          </div>
        </div>
      </div>
    </main>

    <!-- Back to Top Button -->
    <transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <button 
        v-if="showScrollTop"
        @click="scrollToTop"
        class="fixed bottom-24 right-6 w-12 h-12 bg-white text-okinawa-blue rounded-full shadow-2xl border border-techo-ink/5 flex items-center justify-center z-40 active:scale-90 transition-transform"
      >
        <ChevronUp class="w-6 h-6" />
      </button>
    </transition>

    <!-- Bottom Navigation -->
    <nav class="fixed bottom-6 left-6 right-6 bg-white/80 backdrop-blur-lg rounded-full shadow-2xl border border-white/20 p-2 flex justify-between items-center z-50">
      <button 
        v-for="view in views" 
        :key="view.id"
        @click="currentView = view.id"
        :class="[
          'flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all',
          currentView === view.id ? 'bg-okinawa-blue text-white shadow-lg' : 'text-techo-ink/40 hover:bg-techo-ink/5'
        ]"
      >
        <component :is="view.icon" class="w-5 h-5" />
        <span class="text-[10px] mt-0.5 font-bold" v-if="currentView === view.id">{{ view.label }}</span>
      </button>
    </nav>

    <!-- Toast Notification -->
    <transition
      enter-active-class="transform transition ease-out duration-300"
      enter-from-class="translate-y-10 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transform transition ease-in duration-200"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-10 opacity-0"
    >
      <div v-if="toast.show" class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 min-w-[200px] justify-center"
        :class="[
          toast.type === 'error' ? 'bg-red-500 text-white' : 
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 
          'bg-techo-ink text-white'
        ]"
      >
        <AlertCircle v-if="toast.type === 'error'" class="w-4 h-4" />
        <CheckCircle2 v-else-if="toast.type === 'success'" class="w-4 h-4" />
        <span class="text-sm font-bold">{{ toast.message }}</span>
      </div>
    </transition>

    <!-- Password Modal -->
    <div v-if="showPasswordModal" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm">
      <div class="bg-white w-full max-w-xs rounded-3xl p-8 shadow-2xl">
        <h2 class="text-xl font-bold text-techo-ink mb-6 text-center">請輸入編輯密碼</h2>
        <input 
          v-model="passwordInput" 
          type="password" 
          inputmode="numeric"
          pattern="[0-9]*"
          class="w-full p-4 bg-techo-ink/5 rounded-2xl mb-6 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-okinawa-blue"
          placeholder="••••"
          @keyup.enter="verifyPassword"
        >
        <div class="flex gap-3">
          <button @click="showPasswordModal = false" class="flex-grow py-3 text-techo-ink/40 font-bold">取消</button>
          <button @click="verifyPassword" class="flex-grow py-3 bg-okinawa-blue text-white rounded-xl font-bold">確認</button>
        </div>
      </div>
    </div>

    <div v-if="showEditItemModal" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/20 backdrop-blur-sm">
      <div class="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-8">
          <h2 class="text-2xl font-bold text-techo-ink">{{ isNewItem ? '新增行程' : '編輯行程' }}</h2>
          <button @click="showEditItemModal = false" class="p-2 bg-techo-ink/5 rounded-full">
            <X class="w-6 h-6 text-techo-ink/40" />
          </button>
        </div>

        <div class="space-y-6">
          <div>
            <label class="block text-xs font-bold text-techo-ink/40 mb-2 uppercase tracking-wider">時間</label>
            <input v-model="editingItem.time" type="time" class="w-full p-4 bg-techo-ink/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-okinawa-blue">
          </div>
          <div>
            <label class="block text-xs font-bold text-techo-ink/40 mb-2 uppercase tracking-wider">標題</label>
            <input v-model="editingItem.title" type="text" class="w-full p-4 bg-techo-ink/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-okinawa-blue" placeholder="例如：波上宮">
          </div>
          <div>
            <label class="block text-xs font-bold text-techo-ink/40 mb-2 uppercase tracking-wider">類別</label>
            <select v-model="editingItem.type" @change="updateTypeLabel" class="w-full p-4 bg-techo-ink/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-okinawa-blue">
              <option value="sightseeing">景點</option>
              <option value="food">美食</option>
              <option value="transport">交通</option>
              <option value="accommodation">住宿</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-techo-ink/40 mb-2 uppercase tracking-wider">地點 (Google Maps 搜尋用)</label>
            <input v-model="editingItem.location" type="text" class="w-full p-4 bg-techo-ink/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-okinawa-blue" placeholder="例如：Naminoue Shrine">
          </div>
          <div>
            <label class="block text-xs font-bold text-techo-ink/40 mb-2 uppercase tracking-wider">備註</label>
            <textarea v-model="editingItem.note" rows="3" class="w-full p-4 bg-techo-ink/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-okinawa-blue" placeholder="行程詳細說明..."></textarea>
          </div>
        </div>

        <button @click="saveItem" class="w-full mt-8 py-4 bg-okinawa-blue text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-transform">
          儲存行程
        </button>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="showDeleteConfirmModal" class="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm">
      <div class="bg-white w-full max-w-xs rounded-3xl p-8 shadow-2xl text-center">
        <div class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 class="w-8 h-8" />
        </div>
        <h2 class="text-xl font-bold text-techo-ink mb-2">確定要刪除嗎？</h2>
        <p class="text-sm text-techo-ink/40 mb-8">此操作無法復原，請確認是否刪除此行程項目。</p>
        <div class="flex gap-3">
          <button @click="showDeleteConfirmModal = false" class="flex-grow py-3 bg-techo-ink/5 text-techo-ink/40 rounded-xl font-bold">取消</button>
          <button @click="confirmDelete" class="flex-grow py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/20">確定刪除</button>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="selectedItem" class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div @click="selectedItem = null" class="absolute inset-0 bg-techo-ink/40 backdrop-blur-sm"></div>
      <div class="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-8 relative shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div class="w-12 h-1.5 bg-techo-ink/10 rounded-full mx-auto mb-6 sm:hidden"></div>
        
        <div class="flex justify-between items-start mb-6">
          <div>
            <div :class="['inline-block px-3 py-1 rounded-full text-white text-xs font-bold mb-2', selectedItem.color]">
              {{ selectedItem.type.toUpperCase() }}
            </div>
            <h2 class="text-2xl font-bold">{{ selectedItem.title }}</h2>
          </div>
          <button @click="selectedItem = null" class="p-2 hover:bg-techo-ink/5 rounded-full">
            <Plus class="w-6 h-6 rotate-45 text-techo-ink/40" />
          </button>
        </div>

        <div class="space-y-6">
          <div class="flex items-center gap-4 text-techo-ink/60">
            <Clock class="w-5 h-5" />
            <span class="font-medium">{{ selectedItem.time }}</span>
          </div>
          <div class="flex items-center gap-4 text-techo-ink/60">
            <MapPin class="w-5 h-5" />
            <span class="font-medium">{{ selectedItem.location }}</span>
          </div>
          
          <div class="pt-4 border-t border-techo-ink/5">
            <p class="text-xs font-bold text-techo-ink/40 mb-2 uppercase tracking-widest">備註</p>
            <p class="text-sm leading-relaxed">{{ selectedItem.note || '尚無備註。' }}</p>
          </div>

          <div class="pt-4">
            <p class="text-xs font-bold text-techo-ink/40 mb-3 uppercase tracking-widest">照片紀錄</p>
            <div class="grid grid-cols-3 gap-2">
              <div class="aspect-square bg-techo-ink/5 rounded-xl border-2 border-dashed border-techo-ink/10 flex items-center justify-center text-techo-ink/20">
                <Plus class="w-6 h-6" />
              </div>
            </div>
          </div>

          <button class="w-full bg-okinawa-blue text-white py-4 rounded-2xl font-bold shadow-lg mt-4">
            開啟 Google Maps
          </button>
        </div>
      </div>
    </div>

    <!-- Image Zoom Modal (Swipable) -->
    <div v-if="zoomedImageIndex !== null && selectedHotel" class="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
      <div class="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
        <div class="text-white">
          <p class="text-xs font-bold opacity-60 uppercase tracking-widest">{{ selectedHotel.name }}</p>
          <p class="text-lg font-bold">{{ zoomedImageIndex + 1 }} / {{ selectedHotel.images.length }}</p>
        </div>
        <button @click="zoomedImageIndex = null" class="p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors backdrop-blur-md">
          <X class="w-8 h-8" />
        </button>
      </div>

      <div 
        ref="zoomedSliderRef"
        class="flex-grow flex overflow-x-auto snap-x snap-mandatory no-scrollbar relative"
        @scroll="(e) => {
          const target = e.target as HTMLElement;
          zoomedImageIndex = Math.round(target.scrollLeft / target.clientWidth);
        }"
      >
        <!-- Left/Right Navigation Buttons -->
        <button 
          @click.stop="prevImage" 
          class="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm transition-all active:scale-90"
        >
          <ChevronLeft class="w-6 h-6" />
        </button>
        <button 
          @click.stop="nextImage" 
          class="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm transition-all active:scale-90"
        >
          <ChevronRight class="w-6 h-6" />
        </button>

        <div v-for="(img, idx) in selectedHotel.images" :key="idx" class="min-w-full h-full flex items-center justify-center snap-center p-4">
          <img 
            :src="img" 
            class="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
            referrerPolicy="no-referrer" 
            crossorigin="anonymous"
          />
        </div>
      </div>

      <div class="absolute bottom-10 left-0 right-0 flex justify-center gap-2 z-10">
        <div 
          v-for="(_, idx) in selectedHotel.images" 
          :key="idx"
          class="w-2 h-2 rounded-full transition-all duration-300"
          :class="zoomedImageIndex === idx ? 'w-8 bg-okinawa-blue' : 'bg-white/20'"
        ></div>
      </div>
    </div>

    <!-- Hotel Details Modal -->
    <div v-if="selectedHotel" class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div class="bg-white w-full max-w-lg max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300">
        <!-- Header with Slider -->
        <div class="relative h-72 flex-shrink-0 group">
          <div 
            ref="hotelDetailsSliderRef"
            class="flex overflow-x-auto snap-x snap-mandatory no-scrollbar h-full"
            @scroll="(e) => {
              const target = e.target as HTMLElement;
              hotelDetailsImageIndex = Math.round(target.scrollLeft / target.clientWidth);
            }"
          >
            <div v-for="(img, idx) in selectedHotel.images" :key="idx" class="min-w-full h-full snap-center relative cursor-zoom-in" @click="openZoom(idx)">
              <img :src="img" class="w-full h-full object-cover" referrerPolicy="no-referrer" crossorigin="anonymous" />
              <div class="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-white font-bold">
                {{ idx + 1 }} / {{ selectedHotel.images.length }}
              </div>
            </div>
          </div>

          <!-- Navigation Buttons -->
          <button 
            @click.stop="prevHotelImage" 
            class="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft class="w-5 h-5" />
          </button>
          <button 
            @click.stop="nextHotelImage" 
            class="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronRight class="w-5 h-5" />
          </button>

          <div class="absolute bottom-4 right-4 bg-okinawa-blue/80 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] text-white font-bold z-10 animate-bounce">
            ← 左右滑動查看更多 →
          </div>
          <div class="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-white pointer-events-none">
            <h2 class="text-2xl font-bold">{{ selectedHotel.name }}</h2>
            <p class="text-xs opacity-80">{{ selectedHotel.nameEn }}</p>
          </div>
        </div>
        
        <!-- Content Area -->
        <div class="p-6 space-y-6 overflow-y-auto flex-grow">
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl w-fit">
              <CheckCircle2 class="w-5 h-5" />
              <span class="font-bold text-sm">已預訂 ({{ selectedHotel.provider }})</span>
            </div>

            <div 
              v-if="(selectedHotel.freeCancellationDate || defaultHotels.find(d => d.id === selectedHotel.id)?.freeCancellationDate) && !isDatePassed(selectedHotel.freeCancellationDate || defaultHotels.find(d => d.id === selectedHotel.id)?.freeCancellationDate || '')" 
              class="bg-orange-50 p-4 rounded-2xl border border-orange-100"
            >
              <div class="flex items-center gap-2 text-orange-700 mb-1">
                <AlertCircle class="w-4 h-4" />
                <span class="text-xs font-bold uppercase tracking-wider">取消政策</span>
              </div>
              <p class="text-sm text-orange-900 font-medium">
                免費取消期限：<span class="font-bold">{{ selectedHotel.freeCancellationDate || defaultHotels.find(d => d.id === selectedHotel.id)?.freeCancellationDate }}</span> 23:59 前
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div>
              <p class="text-[10px] font-bold text-techo-ink/40 uppercase tracking-widest mb-1">入住 (Check-in)</p>
              <p class="font-bold text-techo-ink">{{ selectedHotel.checkInDate }}</p>
              <p class="text-sm text-techo-ink/60">{{ selectedHotel.checkInTime }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold text-techo-ink/40 uppercase tracking-widest mb-1">退房 (Check-out)</p>
              <p class="font-bold text-techo-ink">{{ selectedHotel.checkOutDate }}</p>
              <p class="text-sm text-techo-ink/60">{{ selectedHotel.checkOutTime }}</p>
            </div>
          </div>

          <div class="pt-4 border-t border-techo-ink/5">
            <p class="text-[10px] font-bold text-techo-ink/40 uppercase tracking-widest mb-2">客房詳情</p>
            <p class="font-bold text-techo-ink">{{ selectedHotel.roomType }}</p>
            <p class="text-xs text-techo-ink/40 mt-1">入住人數：{{ selectedHotel.guests }}</p>
            <p class="text-xs text-techo-ink/40 mt-1">行程編號：{{ selectedHotel.bookingId }}</p>
          </div>

          <div class="pt-4 border-t border-techo-ink/5">
            <p class="text-[10px] font-bold text-techo-ink/40 uppercase tracking-widest mb-2">地點</p>
            <p 
              class="text-sm text-techo-ink/80 leading-relaxed cursor-pointer hover:text-okinawa-blue transition-colors flex items-start gap-2 group"
              @click="openMap(selectedHotel.location, selectedHotel.mapUrl)"
            >
              <MapPin class="w-4 h-4 mt-0.5 flex-shrink-0 text-okinawa-blue group-hover:scale-110 transition-transform" />
              <span class="underline decoration-okinawa-blue/30 underline-offset-4">{{ selectedHotel.location }}</span>
            </p>
          </div>
        </div>
        
        <div class="p-6 bg-techo-ink/5 border-t border-techo-ink/5">
          <button @click="selectedHotel = null" class="w-full py-4 bg-okinawa-blue text-white rounded-2xl font-bold shadow-lg shadow-okinawa-blue/20 active:scale-95 transition-transform">
            關閉
          </button>
        </div>
      </div>
    </div>

    <!-- Flight Details Modal -->
    <div v-if="selectedFlightCode" class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div class="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        <div class="p-6 border-b border-techo-ink/5 flex justify-between items-center bg-techo-ink/5">
          <h2 class="text-xl font-bold text-techo-ink flex items-center gap-2">
            <Plane class="w-5 h-5 text-okinawa-blue" />
            {{ flightDetailsData[selectedFlightCode].title }}
          </h2>
          <button @click="selectedFlightCode = null" class="p-2 hover:bg-techo-ink/10 rounded-full transition-colors">
            <X class="w-6 h-6 text-techo-ink/40" />
          </button>
        </div>
        
        <div class="p-6 overflow-y-auto max-h-[70vh]">
          <!-- Table Type (IT232) -->
          <div v-if="flightDetailsData[selectedFlightCode].type === 'table'" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-techo-ink/40 border-b border-techo-ink/5">
                  <th v-for="h in flightDetailsData[selectedFlightCode].headers" :key="h" class="pb-3 text-left font-bold uppercase tracking-wider">{{ h }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-techo-ink/5">
                <tr v-for="row in flightDetailsData[selectedFlightCode].rows" :key="row.name">
                  <td class="py-4 font-bold text-techo-ink">{{ row.name }}</td>
                  <td class="py-4 text-techo-ink/60">{{ row.baggage }}</td>
                  <td class="py-4 text-techo-ink/60">{{ row.meal }}</td>
                  <td class="py-4 font-mono font-bold text-okinawa-blue">{{ row.seat }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Grid Type (FD 231) -->
          <div v-if="flightDetailsData[selectedFlightCode].type === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div v-for="p in flightDetailsData[selectedFlightCode].passengers" :key="p.name" class="bg-techo-ink/5 rounded-2xl p-5">
              <h3 class="font-bold text-lg mb-4 text-okinawa-blue border-b border-okinawa-blue/10 pb-2">{{ p.name }}</h3>
              <ul class="space-y-3">
                <li v-for="item in p.items" :key="item" class="flex items-start gap-3 text-sm text-techo-ink/70">
                  <div class="mt-1">
                    <CheckCircle2 v-if="!item.includes('座位') && !item.includes('行李')" class="w-3.5 h-3.5 text-emerald-500" />
                    <Wallet v-else-if="item.includes('行李')" class="w-3.5 h-3.5 text-okinawa-blue" />
                    <MapPin v-else class="w-3.5 h-3.5 text-orange-500" />
                  </div>
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        <div class="p-6 bg-techo-ink/5 border-t border-techo-ink/5 flex justify-end">
          <button @click="selectedFlightCode = null" class="px-8 py-3 bg-okinawa-blue text-white rounded-xl font-bold shadow-lg shadow-okinawa-blue/20 active:scale-95 transition-transform">
            關閉
          </button>
        </div>
      </div>
    </div>

    <!-- Declaration Modal -->
    <div v-if="showDeclarationModal" class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-okinawa-blue/20 backdrop-blur-md">
      <div class="bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl border border-okinawa-blue/10 animate-in zoom-in duration-300">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-okinawa-blue/10 text-okinawa-blue rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 class="w-8 h-8" />
          </div>
          <h2 class="text-2xl font-bold text-techo-ink">行前宣示</h2>
        </div>

        <div class="bg-techo-ink/5 rounded-3xl p-6 mb-6 space-y-3">
          <p class="text-sm font-bold text-okinawa-blue">1. 絕不表現不耐煩的態度</p>
          <p class="text-sm font-bold text-okinawa-blue">2. 絕不對任何行程指手畫腳</p>
          <p class="text-sm font-bold text-okinawa-blue">3. 絕不擅自消失</p>
          <p class="text-sm font-bold text-okinawa-blue">4. 該花錢就花錢要省回家再省</p>
          <p class="text-sm font-bold text-okinawa-blue">5. 該休息就休息累了就說</p>
          <p class="text-sm font-bold text-okinawa-blue">6. 有臨時想逛、想看、想吃的絕對要說</p>
          <p class="text-sm font-bold text-okinawa-blue">7. 開開心心出遊 平平安安回家</p>
          
          <div class="pt-3 mt-3 border-t border-techo-ink/10 text-techo-ink/60 text-xs leading-relaxed space-y-1">
            <p>不管發生什麼事我都會聽從指示</p>
            <p>行程我都事先同意過了</p>
            <p>不會臨場抱怨別人的安排</p>
            <p class="font-bold text-red-500">如有違反我直接請吃晚餐</p>
          </div>
        </div>

        <button 
          @click="closeDeclaration"
          class="w-full py-4 bg-okinawa-blue text-white rounded-2xl font-bold shadow-lg shadow-okinawa-blue/20 active:scale-95 transition-transform"
        >
          {{ hasDeclared ? '已宣示' : '我宣示' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

body {
  background-image: radial-gradient(#7BBFEA11 1px, transparent 1px);
  background-size: 20px 20px;
}
</style>
