import { StoreSettingsForm } from './StoreSettingsForm.jsx';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // For file uploads
import React, { 
  useState, 
  useEffect, 
  createContext, 
  useContext, 
  useMemo
} from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { 
  Package, 
  LayoutDashboard, 
  Store, 
  LogOut, 
  Plus, 
  Trash2, 
  Edit, 
  Loader2, 
  ImageOff, 
  Copy,
  AlertCircle,
  ShoppingCart,
  X,
  Minus,
  CheckCircle,
  Eye,
  Mail,
  UserCheck,
  UserX,
  Shield,
  Send,
  Upload
} from 'lucide-react';

// --- Firebase Configuration ---
// !!! CRITICAL: PASTE YOUR OWN FIREBASE CONFIGURATION HERE !!!
const firebaseConfig = {
  apiKey: "AIzaSyDeQl_WStM2eONC4s32aDL4wZ-_VFUVSQs",
  authDomain: "webjor-b29c9.firebaseapp.com",
  projectId: "webjor-b29c9",
  storageBucket: "webjor-b29c9.appspot.com",
  messagingSenderId: "45413385008",
  appId: "1:45413385008:web:f6cf9949c67e91a621bef5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); // Initialize Storage

// --- Cart Context (No Changes) ---
const CartContext = createContext();
const CartActionsContext = createContext();
export function useCart() { return useContext(CartContext); }
export function useCartActions() { return useContext(CartActionsContext); }

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  useEffect(() => {
    const storedCart = localStorage.getItem('storeCart');
    if (storedCart) setCart(JSON.parse(storedCart));
  }, []);

  useEffect(() => {
    localStorage.setItem('storeCart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product, quantity) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        const newQuantity = Math.min(existing.stock, existing.quantity + quantity);
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: newQuantity } : item
        );
      }
      const newQuantity = Math.min(product.stock, quantity);
      return [...prev, { ...product, quantity: newQuantity }];
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId, newQuantity) => {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    if (newQuantity <= 0) {
      removeFromCart(productId);
    } else {
      const finalQuantity = Math.min(item.stock, newQuantity);
      setCart((prev) =>
        prev.map((i) =>
          i.id === productId ? { ...i, quantity: finalQuantity } : i
        )
      );
    }
  };

  const clearCart = () => setCart([]);
  const actions = { addToCart, removeFromCart, updateQuantity, clearCart };

  return (
    <CartContext.Provider value={cart}>
      <CartActionsContext.Provider value={actions}>
        {children}
      </CartActionsContext.Provider>
    </CartContext.Provider>
  );
}

// --- Main App Component ---
export default function App() {
  const [page, setPage] = useState('home');
  const [urlParam, setUrlParam] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Handle Authentication State & Admin Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const adminRef = doc(db, "admins", user.uid);
          const adminSnap = await getDoc(adminRef);
          if (adminSnap.exists() && adminSnap.data().role === 'admin') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (err) {
          console.error("Admin check failed:", err);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Handle Hash Routing (Uses URL for routing)
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname.slice(1); // Get path after root (e.g., myshop)
      const hash = window.location.hash.slice(1); // Get hash (e.g., dashboard)

      // 1. Check for Custom Path (Subdomain routing logic)
      if (path) {
        // We assume the path is the customPath/storeId (e.g., /myshop)
        setPage('store');
        setUrlParam(path);
      } 
      // 2. Check for Hash Routes (Internal app routes)
      else if (hash === 'dashboard') {
        setPage('dashboard');
      } else if (hash === 'admin') {
        setPage('admin');
      } else if (hash === 'login' || hash === 'signup') {
        setPage('auth');
      } else {
        setPage('home');
      }
    };

    // Listen for both hash changes (internal routes) and popstate (path changes, like clicking back)
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    handleLocationChange();

    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);


  // Global Error & Success Handlers
  const showError = (message, duration = 4000) => {
    setError(message);
    setTimeout(() => setError(null), duration);
  };
  const showSuccess = (message, duration = 4000) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), duration);
  }

  if (!isAuthReady) {
    return <FullScreenLoader message="Connecting to service..." />;
  }

  // Main Page Router
  const renderPage = () => {
    if (page === 'store') {
      return <PublicStorePage pathOrId={urlParam} showError={showError} />; // Uses pathOrId now
    }
    if (page === 'admin') {
      if (user && isAdmin) {
        return <AdminPage showError={showError} showSuccess={showSuccess} />;
      }
      if (user && !isAdmin) {
        return <FullScreenError message="You do not have permission to access this page." />;
      }
      return <AuthPage showError={showError} showSuccess={showSuccess} />;
    }
    if (page === 'dashboard') {
      return user ? <DashboardPage user={user} showError={showError} showSuccess={showSuccess} /> : <AuthPage showError={showError} showSuccess={showSuccess} />;
    }
    if (page === 'auth') {
      return user ? <Navigate to="#dashboard" /> : <AuthPage showError={showError} showSuccess={showSuccess} />;
    }
    return user ? <Navigate to="#dashboard" /> : <AuthPage showError={showError} showSuccess={showSuccess} />;
  };

  return (
    <CartProvider>
      <div className="min-h-screen bg-gray-100 font-inter">
        {error && <Notification message={error} type="error" />}
        {success && <Notification message={success} type="success" />}
        {isAdmin && (
          <a
            href="/#admin" // Redirects to hash-based admin route
            className="fixed bottom-4 left-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700"
            title="Admin Dashboard"
          >
            <Shield className="w-6 h-6" />
          </a>
        )}
        {renderPage()}
      </div>
    </CartProvider>
  );
}

// --- Navigation & Routing ---
function Navigate({ to }) {
  useEffect(() => { window.location.hash = to; }, [to]);
  return null;
}

function Notification({ message, type = 'error' }) {
  const bgColor = type === 'error' ? 'bg-red-600' : 'bg-green-600';
  const icon = type === 'error' ? <AlertCircle className="w-5 h-5 mr-3" /> : <CheckCircle className="w-5 h-5 mr-3" />;
  
  return (
    <div className={`fixed top-4 right-4 z-[100] ${bgColor} text-white p-4 rounded-lg shadow-lg flex items-center`}>
      {icon}
      <span>{message}</span>
    </div>
  );
}

function FullScreenLoader({ message }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      {message && <span className="mt-4 text-xl font-semibold text-gray-700">{message}</span>}
    </div>
  );
}

// --- I. Authentication Pages ---

function AuthPage({ showError, showSuccess }) {
  const [isLogin, setIsLogin] = useState(window.location.hash !== '#signup');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Handle Firebase Auth
  const handleLogin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      showError(error.message);
    }
  };

  const handleSignup = async (email, password, ownerName, storeName, phone) => {
    if (!email || !password || !storeName || !phone || !ownerName) {
      showError("All fields are required for sign up.");
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const storeRef = doc(db, "stores", user.uid);
      await setDoc(storeRef, {
        userId: user.uid,
        ownerName: ownerName,
        email: email,
        name: storeName,
        phone: phone,
        logoUrl: '',
        themeColor: '#3b82f6',
        createdAt: serverTimestamp(),
        isActive: true, 
        subscriptionEnds: null,
        customPath: null // <-- NEW FIELD
      });
    } catch (error) {
      showError(error.message);
    }
  };
  
  const handlePasswordReset = async (email) => {
    if (!email) {
      showError("Please enter your email address.");
      return;
    }
    try {
      // NOTE: This now calls a hypothetical Cloud Function for custom email
      const response = await fetch('YOUR_CLOUD_FUNCTION_ENDPOINT/resetPassword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });

      if (response.ok) {
         showSuccess("Password reset email sent (via custom backend)! Check your inbox.");
         setShowForgotPassword(false);
      } else {
        // Fallback to Firebase's default method if custom fails, but log a warning
        await sendPasswordResetEmail(auth, email);
        showSuccess("Password reset email sent via Firebase default. Check your inbox.");
        setShowForgotPassword(false);
      }
    } catch (error) {
      console.error("Custom reset attempt failed:", error);
      showError("Failed to send reset email. Check console for details.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-xl">
        <div className="text-center">
          <Store className="w-12 h-12 mx-auto text-blue-600" />
          <h2 className="mt-4 text-3xl font-extrabold text-gray-900">
            {showForgotPassword ? 'Reset Password' : (isLogin ? 'Merchant Log In' : 'Create Your Store')}
          </h2>
        </div>
        
        {showForgotPassword ? (
          <ForgotPasswordForm onSubmit={handlePasswordReset} />
        ) : isLogin ? (
          <LoginForm onSubmit={handleLogin} />
        ) : (
          <SignupForm onSubmit={handleSignup} />
        )}
        
        <div className="text-sm text-center text-gray-600">
          {showForgotPassword ? (
            <button
              onClick={() => setShowForgotPassword(false)}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Back to Log In
            </button>
          ) : isLogin ? (
            <>
              <button
                onClick={() => setShowForgotPassword(true)}
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Forgot Password?
              </button>
              <span className="mx-2">|</span>
              <span>Don't have an account?</span>
              <button
                onClick={() => setIsLogin(false)}
                className="ml-1 font-medium text-blue-600 hover:text-blue-500"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              <span>Already have an account?</span>
              <button
                onClick={() => setIsLogin(true)}
                className="ml-1 font-medium text-blue-600 hover:text-blue-500"
              >
                Log In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    onSubmit(email, password).finally(() => setLoading(false));
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AuthInput id="email" type="email" label="Email Address" value={email} onChange={setEmail} />
      <AuthInput id="password" type="password" label="Password" value={password} onChange={setPassword} />
      <AuthButton loading={loading} text="Log In" />
    </form>
  );
}

function SignupForm({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    onSubmit(email, password, ownerName, storeName, phone).finally(() => setLoading(false));
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AuthInput id="ownerName" type="text" label="Your Full Name" value={ownerName} onChange={setOwnerName} /> 
      <AuthInput id="storeName" type="text" label="Store Name" value={storeName} onChange={setStoreName} />
      <AuthInput id="phone" type="tel" label="Phone (for alerts)" value={phone} onChange={setPhone} />
      <AuthInput id="email" type="email" label="Email Address" value={email} onChange={setEmail} />
      <AuthInput id="password" type="password" label="Password (min. 6 chars)" value={password} onChange={setPassword} />
      <AuthButton loading={loading} text="Create Account" />
    </form>
  );
}

function ForgotPasswordForm({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    onSubmit(email).finally(() => setLoading(false));
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">Enter your email and we'll send you a link to reset your password.</p>
      <AuthInput id="email" type="email" label="Email Address" value={email} onChange={setEmail} />
      <AuthButton loading={loading} text="Send Reset Email" icon={<Mail className="w-5 h-5 mr-2" />} />
    </form>
  );
}

function AuthInput({ id, type, label, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}

function AuthButton({ loading, text, icon = null }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (icon || text)}
      {!loading && icon && <span className="ml-2">{text}</span>}
    </button>
  );
}

// --- II. Merchant Dashboard ---

function DashboardNav({ storeName }) {
  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <LayoutDashboard className="h-8 w-8 text-blue-600" />
            <span className="ml-3 text-xl font-bold text-gray-900">{storeName || 'Dashboard'}</span>
          </div>
          <div className="flex items-center">
            <button
              onClick={() => signOut(auth)}
              className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function DashboardPage({ user, showError, showSuccess }) {
  const storeId = user.uid;
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);

  // Listen to Store Info
  useEffect(() => {
    if (!storeId) return;
    const storeRef = doc(db, "stores", storeId);
    const unsubscribe = onSnapshot(storeRef, (doc) => {
      if (doc.exists()) {
        const storeData = { id: doc.id, ...doc.data() };
        setStore(storeData);
        if (storeData.isActive === false) {
          showError("Your account is inactive. Please contact support.");
        }
      } else {
        showError("Store data not found! This is a critical error.");
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to store:", error);
      showError(`Store Error: ${error.message}`);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [storeId, showError]);

  // Listen to Products (Only if store is loaded)
  useEffect(() => {
    if (!storeId || !store) return;
    const productsRef = collection(db, "stores", storeId, "products");
    const q = query(productsRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error listening to products:", error);
      showError(`Product Error: ${error.message}`);
    });
    return () => unsubscribe();
  }, [storeId, store, showError]);

  // Listen to Orders (Only if store is loaded)
  useEffect(() => {
    if (!storeId || !store) return;
    const ordersRef = collection(db, "stores", storeId, "orders");
    const q = query(ordersRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error listening to orders:", error);
      showError(`Order Error: ${error.message}`);
    });
    return () => unsubscribe();
  }, [storeId, store, showError]);

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, "stores", storeId, "orders", orderId);
      await updateDoc(orderRef, { status: newStatus });
      showSuccess(`Order ${orderId.slice(-4)} status updated to ${newStatus}.`);
    } catch (error) {
      showError(`Failed to update order status: ${error.message}`);
    }
  };


  if (loading) {
    return <FullScreenLoader message="Loading dashboard..." />;
  }

  // Determine the primary store URL based on custom path or default ID
  const storePath = store?.customPath || storeId;
  const storeUrl = store?.customPath 
    ? `${window.location.origin}/${storePath}` // Use path for deployment with rewrites
    : `${window.location.origin}/#store/${storePath}`; // Fallback to hash route

  return (
    <>
      <DashboardNav storeName={store?.name} />
      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        
        {store && store.isActive === false && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-lg shadow-md" role="alert">
            <p className="font-bold">Account Inactive</p>
            <p>Your store is not visible to the public. Please update your subscription or contact support.</p>
          </div>
        )}
        
        <StoreLinkCard storeUrl={storeUrl} customPath={store?.customPath} storeId={storeId} />
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-3">Subscription</h2>
          <p className="text-gray-600 mb-4">Manage your subscription and payment methods.</p>
          <button 
            onClick={() => alert("Redirecting to Stripe Customer Portal...")}
            className="px-6 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
          >
            Manage Subscription
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <ProductForm
              storeId={storeId}
              showError={showError}
              product={editingProduct}
              onDone={() => setEditingProduct(null)}
            />
            <StoreSettingsForm
              store={store}
              storeId={storeId}
              showError={showError}
              showSuccess={showSuccess}
            />
          </div>
          <div className="lg:col-span-2 space-y-8">
            <ProductList
              products={products}
              storeId={storeId}
              showError={showError}
              onEdit={(product) => setEditingProduct(product)}
            />
            <OrderList orders={orders} handleUpdateOrderStatus={handleUpdateOrderStatus} />
          </div>
        </div>
      </main>
    </>
  );
}

function StoreLinkCard({ storeUrl, customPath, storeId }) {
  const [copied, setCopied] = useState(false);
  const copyToClipboard = () => {
    const ta = document.createElement('textarea');
    ta.value = storeUrl;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
    document.body.removeChild(ta);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-3">Your Public Store Link</h2>
      <div className="flex items-center text-sm mb-4">
        <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
        <p className="text-gray-600">
          {customPath 
            ? `Your custom path is active. URL uses: ${window.location.origin}/${customPath}`
            : `To use a cleaner URL (e.g., /myshop), set a Custom Store Path in settings.`
          }
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          readOnly
          value={storeUrl}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
        />
        <button
          onClick={copyToClipboard}
          className={`flex items-center justify-center px-4 py-2 rounded-md shadow-sm w-full sm:w-auto ${
            copied ? 'bg-green-600' : 'bg-blue-600'
          } text-white hover:bg-blue-700`}
        >
          {copied ? (
            <CheckCircle className="w-4 h-4 mr-2" />
          ) : (
            <Copy className="w-4 h-4 mr-2" />
          )}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 w-full sm:w-auto"
        >
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </a>
      </div>
    </div>
  );
}

function ProductForm({ storeId, showError, product, onDone }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const isEditing = !!product;

  useEffect(() => {
    if (product) {
      setName(product.name);
      setPrice(product.price);
      setStock(product.stock);
      setImageUrl(product.imageUrl || '');
    }
  }, [product]);
  
  const clearForm = () => {
    setName('');
    setPrice('');
    setStock('');
    setImageUrl('');
    onDone();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const productData = {
        name,
        price: parseFloat(price),
        stock: parseInt(stock),
        imageUrl,
      };

      if (isEditing) {
        const productRef = doc(db, "stores", storeId, "products", product.id);
        await updateDoc(productRef, { ...productData, updatedAt: serverTimestamp() });
      } else {
        const collectionRef = collection(db, "stores", storeId, "products");
        await addDoc(collectionRef, { ...productData, createdAt: serverTimestamp() });
      }
      clearForm();
    } catch (error) {
      showError(error.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4 sticky top-8">
      <h2 className="text-xl font-semibold mb-3">
        {isEditing ? 'Edit Product' : 'Add New Product'}
      </h2>
      <FormInput label="Name" value={name} onChange={setName} required />
      <FormInput label="Price ($)" type="number" step="0.01" value={price} onChange={setPrice} required />
      <FormInput label="Stock" type="number" step="1" value={stock} onChange={setStock} required />
      <FormInput label="Image URL" type="url" value={imageUrl} onChange={setImageUrl} />
      <div className="flex gap-2">
        {isEditing && (
          <button
            type="button"
            onClick={clearForm}
            className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center px-4 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isEditing ? 'Save Changes' : 'Add Product')}
        </button>
      </div>
    </form>
  );
}

function FormInput({ label, type = "text", value, onChange, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
      />
    </div>
  );
}

function ProductList({ products, storeId, showError, onEdit }) {
  const deleteProduct = async (productId) => {
    try {
      const productRef = doc(db, "stores", storeId, "products", productId);
      await deleteDoc(productRef);
    } catch (error) {
      showError(error.message);
    }
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-3">Your Inventory</h2>
      <div className="space-y-4">
        {products.length === 0 ? (
          <p className="text-gray-500">You haven't added any products yet.</p>
        ) : (
          products.map((product) => (
            <div key={product.id} className="flex items-center space-x-4 p-4 border rounded-md">
              <ProductImage src={product.imageUrl} alt={product.name} className="w-16 h-16 rounded-md object-cover" />
              <div className="flex-1">
                <h3 className="font-semibold">{product.name}</h3>
                <p className="text-sm text-gray-600">
                  ${product.price?.toFixed(2)} - {product.stock} in stock
                </p>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => onEdit(product)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-md">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => deleteProduct(product.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-md">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const statusOptions = ['PENDING', 'SHIPPED', 'COMPLETED'];
function OrderList({ orders, handleUpdateOrderStatus }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-3">Recent Orders</h2>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {orders.length === 0 ? (
          <p className="text-gray-500">You have no orders yet.</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="p-4 border rounded-md shadow-sm bg-gray-50">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-gray-800">Order ID: {order.id.slice(-6)}</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                  order.status === 'SHIPPED' ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {order.status || 'PENDING'}
                </span>
              </div>
              <p className="text-sm text-gray-600">Customer: {order.customerName} ({order.customerPhone})</p>
              <p className="text-sm text-gray-600">Address: {order.customerAddress}</p>
              <p className="font-bold text-lg text-green-600 mt-1">${order.total?.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">
                Placed: {new Date(order.createdAt?.toDate()).toLocaleString()}
              </p>
              
              {/* Items List */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-1">Items:</h4>
                <ul className="text-xs space-y-0.5">
                  {order.items.map((item, index) => (
                    <li key={index} className="flex justify-between">
                      <span className="text-gray-700">{item.name}</span>
                      <span className="font-medium text-gray-600">{item.quantity} x ${item.price.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Payment Info */}
              {order.paymentMethod && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <h4 className="text-xs font-semibold uppercase text-gray-500 mb-1">Payment:</h4>
                  <p className="text-sm font-medium">{order.paymentMethod}</p>
                  {order.paymentProofUrl && (
                    <a 
                      href={order.paymentProofUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs text-blue-600 hover:underline flex items-center mt-1"
                    >
                      <Eye className="w-3 h-3 mr-1" /> View Payment Proof
                    </a>
                  )}
                </div>
              )}

              {/* Status Updater */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Update Status:</label>
                <select
                  value={order.status || 'PENDING'}
                  onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- IV. Public Storefront ---

function PublicStorePage({ pathOrId, showError }) {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => {
    if (!pathOrId) {
      setError("Invalid store URL or missing path.");
      setLoading(false);
      return;
    }
    
    const fetchStoreAndProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        let storeData = null;
        let storeIdToUse = pathOrId;

        // 1. Try to find the store by customPath (for clean URLs)
        const customPathQuery = query(collection(db, "stores"), where("customPath", "==", pathOrId));
        const customPathSnap = await getDocs(customPathQuery);

        if (!customPathSnap.empty) {
          storeData = { id: customPathSnap.docs[0].id, ...customPathSnap.docs[0].data() };
          storeIdToUse = storeData.id; // Use the actual store ID for products
        } else {
          // 2. Fallback: Try to find the store by ID (for hash URLs)
          const storeRef = doc(db, "stores", pathOrId);
          const storeSnap = await getDoc(storeRef);
          if (storeSnap.exists()) {
            storeData = { id: storeSnap.id, ...storeSnap.data() };
          }
        }

        if (!storeData) {
          setError("This store does not exist or the URL is incorrect.");
          setLoading(false);
          return;
        }

        setStore(storeData);
        
        if (storeData.isActive === false) {
          setError("This store is currently inactive.");
          setLoading(false);
          return;
        }
        
        document.documentElement.style.setProperty('--theme-color', storeData.themeColor || '#3b82f6');
        
        // 3. Fetch products
        const productsRef = collection(db, "stores", storeIdToUse, "products");
        const q = query(productsRef, where("stock", ">", 0));
        
        const productsSnap = await getDocs(q);
        const productsData = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        productsData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setProducts(productsData);
        
      } catch (err) {
        console.error("Error fetching store:", err);
        setError(`Could not load this store. Error: ${err.message}`);
      }
      setLoading(false);
    };
    
    fetchStoreAndProducts();
    
    return () => document.documentElement.style.removeProperty('--theme-color');
  }, [pathOrId, showError]);
  
  if (loading) return <FullScreenLoader message="Loading store..." />;
  if (error) return <FullScreenError message={error} />;
  if (!store) return <FullScreenError message="Store data could not be loaded." />;

  return (
    <div className="min-h-screen bg-gray-50">
      <StoreNav store={store} onCartClick={() => setIsCheckoutOpen(true)} />

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 mx-auto text-gray-400" />
            <h2 className="mt-4 text-2xl font-semibold text-gray-700">No products available</h2>
            <p className="mt-2 text-gray-500">This store is currently empty. Please check back later!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <StoreProductCard
                key={product.id}
                product={product}
                onBuyNow={() => setIsCheckoutOpen(true)}
              />
            ))}
          </div>
        )}
      </main>

      <CheckoutDrawer
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        store={store} // Pass full store object for bank info
        showError={showError}
      />
    </div>
  );
}

function StoreNav({ store, onCartClick }) {
  const cart = useCart();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav className="bg-white shadow-md sticky top-0 z-40" style={{ borderBottom: '4px solid var(--theme-color, #3b82f6)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-20">
        <div className="flex items-center space-x-3">
          {store.logoUrl && (
            <img src={store.logoUrl} alt={`${store.name} Logo`} className="h-10 w-10 object-contain rounded-full" />
          )}
          <span className="text-2xl font-bold text-gray-900">{store.name}</span>
        </div>
        <button onClick={onCartClick} className="relative p-2 rounded-full text-gray-700 hover:bg-gray-100">
          <ShoppingCart className="w-6 h-6" />
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 text-xs font-bold text-white rounded-full bg-[var(--theme-color)]">
              {totalItems}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}

function StoreProductCard({ product, onBuyNow }) {
  const { addToCart } = useCartActions();
  const [quantity, setQuantity] = useState(1);

  const handleBuyNow = () => {
    addToCart(product, quantity);
    onBuyNow();
  };
  const handleAddToCart = () => {
    addToCart(product, quantity);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
      <ProductImage src={product.imageUrl} alt={product.name} className="w-full h-56 object-cover" />
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{product.name}</h3>
          <p className="text-2xl font-bold text-gray-800 mt-1">${product.price?.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">{product.stock} in stock</p>
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-center space-x-3">
            <button 
              onClick={() => setQuantity((q) => Math.max(1, q - 1))} 
              className="p-2 rounded-full bg-gray-200 text-gray-700 disabled:opacity-50"
              disabled={quantity <= 1}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-lg font-bold w-10 text-center">{quantity}</span>
            <button 
              onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))} 
              className="p-2 rounded-full bg-gray-200 text-gray-700 disabled:opacity-50"
              disabled={quantity >= product.stock}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button 
              onClick={handleAddToCart} 
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md shadow-sm hover:bg-gray-50"
            >
              Add to Cart
            </button>
            <button 
              onClick={handleBuyNow} 
              className="flex-1 px-4 py-2 text-white rounded-md shadow-sm bg-[var(--theme-color)] hover:opacity-90"
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckoutDrawer({ isOpen, onClose, store, showError }) {
  const cart = useCart();
  const { clearCart } = useCartActions();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [paymentProof, setPaymentProof] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const total = useMemo(() => 
    cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
  [cart]);

  const uploadProof = async () => {
    if (!paymentProof) return null;
    const proofRef = ref(storage, `payment_proofs/${store.id}/${Date.now()}-${paymentProof.name}`);
    await uploadBytes(proofRef, paymentProof);
    return getDownloadURL(proofRef);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    if (cart.length === 0) {
      setError("Your cart is empty.");
      setLoading(false);
      return;
    }
    
    let paymentProofUrl = null;
    if (paymentMethod === 'CLIQ' && paymentProof) {
      try {
        setError('Uploading payment proof...');
        paymentProofUrl = await uploadProof();
        setError(null);
      } catch (err) {
        console.error("Upload failed:", err);
        setError("Failed to upload payment proof. Please try again.");
        setLoading(false);
        return;
      }
    }

    try {
      const orderRef = collection(db, "stores", store.id, "orders");
      const newOrder = {
        storeId: store.id,
        customerName,
        customerPhone,
        customerAddress,
        total,
        items: cart,
        status: "PENDING",
        paymentMethod,
        paymentProofUrl,
        createdAt: serverTimestamp()
      };
      // NOTE: This should ideally call a Cloud Function to handle stock decrement atomically.
      await addDoc(orderRef, newOrder);
      
      showError("Order placed! Stock decrement should be handled by a Cloud Function for reliability.");

      clearCart();
      onClose();
      
      console.log(`--- SIMULATING ORDER NOTIFICATION to ${store.phone} ---`);

    } catch (err) {
      console.error(err);
      setError("Failed to place order. Please try again.");
    }
    setLoading(false);
  };

  return (
    <>
      <div className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl z-50 transform transition-transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-2xl font-semibold">Your Cart</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X className="w-6 h-6" /></button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {cart.length === 0 ? (
              <p className="text-gray-500">Your cart is empty.</p>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex items-center space-x-3">
                  <ProductImage src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded-md object-cover" />
                  <div className="flex-1">
                    <h4 className="font-semibold">{item.name}</h4>
                    <p className="text-sm text-gray-600">${item.price.toFixed(2)}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 rounded-full bg-gray-200"><Minus className="w-3 h-3" /></button>
                      <span>{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)} 
                        className="p-1 rounded-full bg-gray-200 disabled:opacity-50"
                        disabled={item.quantity >= item.stock}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <span className="font-semibold">${(item.quantity * item.price).toFixed(2)}</span>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout Form */}
          {cart.length > 0 && (
            <form onSubmit={handleSubmit} className="p-4 border-t-2 space-y-4">
              <div className="flex justify-between text-xl font-bold">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <h3 className="text-lg font-semibold">Customer Details</h3>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <FormInput label="Name" value={customerName} onChange={setCustomerName} required />
              <FormInput label="Phone" type="tel" value={customerPhone} onChange={setCustomerPhone} required />
              <FormInput label="Address" value={customerAddress} onChange={setCustomerAddress} required />
              
              {/* Payment Method Selector */}
              <div className="space-y-3 pt-2">
                <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="COD"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                      className="form-radio text-blue-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">Cash on Delivery (COD)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="CLIQ"
                      checked={paymentMethod === 'CLIQ'}
                      onChange={() => setPaymentMethod('CLIQ')}
                      className="form-radio text-blue-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">CLIQ (Upload Proof)</span>
                  </label>
                </div>
              </div>

              {/* CLIQ Payment Details and Uploader */}
              {paymentMethod === 'CLIQ' && (
                <div className="bg-blue-50 p-4 rounded-md space-y-3">
                  <h4 className="text-sm font-semibold text-blue-700">Merchant's Bank Details (CLIQ)</h4>
                  <p className="text-xs text-gray-700">
                    **Bank:** {store.bankName || 'N/A'}<br/>
                    **Account:** {store.bankAccount || 'N/A'}
                  </p>
                  <p className="text-xs text-red-500">Please transfer ${total.toFixed(2)} and upload the screenshot below.</p>
                  
                  <label className="block text-sm font-medium text-gray-700">Upload CLIQ Screenshot</label>
                  <div className="flex items-center border border-gray-300 rounded-md p-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPaymentProof(e.target.files[0])}
                      required
                      className="text-sm text-gray-500 file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                    />
                    {paymentProof && (
                      <span className="text-xs font-medium text-green-600 ml-2">File Ready</span>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (paymentMethod === 'CLIQ' && !paymentProof)}
                className="w-full flex justify-center items-center px-6 py-3 text-white rounded-md shadow-sm bg-[var(--theme-color)] hover:opacity-90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Place Order'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}


// --- Utility Components ---
function ProductImage({ src, alt, className }) {
  const [error, setError] = useState(false);
  const handleError = () => setError(true);
  if (error || !src) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
        <ImageOff className="w-1/2 h-1/2" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={handleError} />;
}

function FullScreenError({ message }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-8 text-center">
      <AlertCircle className="w-16 h-16 text-red-500" />
      <h2 className="mt-4 text-2xl font-bold text-gray-900">Oops! Something went wrong.</h2>
      <p className="mt-2 text-gray-600">{message}</p>
      <a href="#" className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700">
        Go Home
      </a>
    </div>
  );
}

// --- Admin Page ---
function AdminPage({ showError, showSuccess }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      setLoading(true);
      try {
        const storesRef = collection(db, "stores");
        const q = query(storesRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching stores:", err);
        showError(`Could not load stores: ${err.message}`);
      }
      setLoading(false);
    };
    fetchStores();
  }, [showError]);

  const handleSetStoreStatus = async (storeId, newStatus) => {
    try {
      const storeRef = doc(db, "stores", storeId);
      await updateDoc(storeRef, { isActive: newStatus });
      setStores(prevStores => 
        prevStores.map(store => 
          store.id === storeId ? { ...store, isActive: newStatus } : store
        )
      );
      showSuccess(`Store has been ${newStatus ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      console.error("Error updating store status:", err);
      showError(`Failed to update status: ${err.message}`);
    }
  };

  if (loading) {
    return <FullScreenLoader message="Loading Admin Dashboard..." />;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">All Stores</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store Name (Path)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner / Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stores.map((store) => (
                <tr key={store.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{store.name}</div>
                    <div className="text-xs text-blue-600">{store.customPath ? `/${store.customPath}` : 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{store.ownerName || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{store.email || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 p-1 rounded">{store.id}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">
                      {store.createdAt ? new Date(store.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {store.isActive ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {store.isActive ? (
                      <button 
                        onClick={() => handleSetStoreStatus(store.id, false)}
                        className="flex items-center px-3 py-1 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 text-xs"
                      >
                        <UserX className="w-4 h-4 mr-1" />
                        Deactivate
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleSetStoreStatus(store.id, true)}
                        className="flex items-center px-3 py-1 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 text-xs"
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Activate
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
  );
}