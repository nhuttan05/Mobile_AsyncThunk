import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, 
  FlatList, ActivityIndicator, SafeAreaView, ScrollView, TextInput, Alert
} from 'react-native';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { configureStore, createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// ==========================================
// 1. KIỂU DỮ LIỆU (TYPESCRIPT)
// ==========================================
interface Product {
  id: number;
  title: string;
  price: number;
}

interface CartItem extends Product {
  quantity: number;
}

interface ProductsState {
  items: Product[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

interface CartState {
  items: CartItem[];
  discountCode: string | null;
  taxRate: number;
  shippingCost: number;
}

// ==========================================
// 2. ASYNC THUNK (GỌI API SẢN PHẨM)
// ==========================================
// Sử dụng FakeStoreAPI để lấy sản phẩm thật thay vì api.example.com
export const fetchProducts = createAsyncThunk('products/fetchProducts', async () => {
  const response = await fetch('https://fakestoreapi.com/products?limit=5');
  if (!response.ok) throw new Error('Không thể tải dữ liệu sản phẩm');
  const data = await response.json();
  return data as Product[];
});

// ==========================================
// 3. REDUX SLICES
// ==========================================

// --- PRODUCTS SLICE ---
const initialProductsState: ProductsState = { items: [], status: 'idle', error: null };
const productsSlice = createSlice({
  name: 'products',
  initialState: initialProductsState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Lỗi không xác định';
      });
  }
});

// --- CART SLICE ---
const initialCartState: CartState = {
  items: [],
  discountCode: null,
  taxRate: 0.1, // Thuế 10%
  shippingCost: 10 // Mặc định phí vận chuyển $10
};

const cartSlice = createSlice({
  name: 'cart',
  initialState: initialCartState,
  reducers: {
    addToCart: (state, action: PayloadAction<Product>) => {
      const existingItem = state.items.find(item => item.id === action.payload.id);
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.items.push({ ...action.payload, quantity: 1 });
      }
    },
    increaseQuantity: (state, action: PayloadAction<number>) => {
      const item = state.items.find(item => item.id === action.payload);
      if (item) item.quantity += 1;
    },
    decreaseQuantity: (state, action: PayloadAction<number>) => {
      const item = state.items.find(item => item.id === action.payload);
      if (item && item.quantity > 1) {
        item.quantity -= 1;
      } else {
        state.items = state.items.filter(i => i.id !== action.payload);
      }
    },
    removeFromCart: (state, action: PayloadAction<number>) => {
      state.items = state.items.filter(item => item.id !== action.payload);
    },
    applyDiscount: (state, action: PayloadAction<string>) => {
      state.discountCode = action.payload;
    },
    setShippingCost: (state, action: PayloadAction<number>) => {
      state.shippingCost = action.payload;
    }
  }
});

export const { addToCart, increaseQuantity, decreaseQuantity, removeFromCart, applyDiscount, setShippingCost } = cartSlice.actions;

// ==========================================
// 4. REDUX STORE & SELECTORS
// ==========================================
const store = configureStore({
  reducer: {
    products: productsSlice.reducer,
    cart: cartSlice.reducer
  }
});

type RootState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

// Selectors Nâng Cao tính toán giá trị giỏ hàng
const selectSubtotal = (state: RootState) => state.cart.items.reduce((total, item) => total + item.price * item.quantity, 0);
const selectDiscount = (state: RootState) => {
  const subtotal = selectSubtotal(state);
  const discountRates: Record<string, number> = { 'SUMMER10': 0.1, 'SPECIAL20': 0.2 };
  const rate = discountRates[state.cart.discountCode || ''] || 0;
  return subtotal * rate;
};
const selectTax = (state: RootState) => selectSubtotal(state) * state.cart.taxRate;
const selectCartSummary = (state: RootState) => {
  const subtotal = selectSubtotal(state);
  const discount = selectDiscount(state);
  const tax = selectTax(state);
  const shipping = state.cart.shippingCost;
  return {
    subtotal, discount, tax, shipping,
    total: subtotal - discount + tax + (subtotal > 0 ? shipping : 0),
    itemCount: state.cart.items.reduce((count, item) => count + item.quantity, 0)
  };
};

// ==========================================
// 5. COMPONENT GIAO DIỆN CHÍNH
// ==========================================
function ShoppingApp() {
  const dispatch = useDispatch<AppDispatch>();
  const { items: products, status } = useSelector((state: RootState) => state.products);
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const summary = useSelector(selectCartSummary);
  
  const [discountInput, setDiscountInput] = useState('');

  // Tự động fetch sản phẩm khi ứng dụng chạy
  useEffect(() => {
    if (status === 'idle') dispatch(fetchProducts());
  }, [status, dispatch]);

  const handleApplyDiscount = () => {
    dispatch(applyDiscount(discountInput.toUpperCase()));
    Alert.alert("Thông báo", "Đã áp dụng mã giảm giá (nếu hợp lệ)");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>🛍️ Cửa Hàng Chuyên Nghiệp (Level 3)</Text>

        {/* --- DANH SÁCH SẢN PHẨM --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danh Sách Sản Phẩm</Text>
          {status === 'loading' ? (
            <ActivityIndicator size="large" color="#0000ff" />
          ) : (
            products.map(product => (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{product.title}</Text>
                  <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => dispatch(addToCart(product))}>
                  <Text style={styles.btnText}>Thêm</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* --- GIỎ HÀNG --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Giỏ Hàng ({summary.itemCount} sản phẩm)</Text>
          {cartItems.length === 0 ? (
            <Text style={styles.emptyCart}>Giỏ hàng trống</Text>
          ) : (
            cartItems.map(item => (
              <View key={item.id} style={styles.cartItem}>
                <Text style={styles.cartItemName} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cartItemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                
                <View style={styles.quantityControls}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => dispatch(decreaseQuantity(item.id))}>
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => dispatch(increaseQuantity(item.id))}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => dispatch(removeFromCart(item.id))}>
                    <Text style={styles.btnText}>Xóa</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* --- OPTIONS VẬN CHUYỂN & GIẢM GIÁ --- */}
        {cartItems.length > 0 && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vận Chuyển & Giảm Giá</Text>
              
              <View style={styles.shippingOptions}>
                <TouchableOpacity style={[styles.shipBtn, summary.shipping === 0 && styles.shipActive]} onPress={() => dispatch(setShippingCost(0))}>
                  <Text style={[styles.shipText, summary.shipping === 0 && styles.shipActiveText]}>Miễn phí</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.shipBtn, summary.shipping === 10 && styles.shipActive]} onPress={() => dispatch(setShippingCost(10))}>
                  <Text style={[styles.shipText, summary.shipping === 10 && styles.shipActiveText]}>Tiêu chuẩn ($10)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.shipBtn, summary.shipping === 25 && styles.shipActive]} onPress={() => dispatch(setShippingCost(25))}>
                  <Text style={[styles.shipText, summary.shipping === 25 && styles.shipActiveText]}>Hỏa tốc ($25)</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.discountBox}>
                <TextInput
                  style={styles.discountInput}
                  placeholder="Mã: SUMMER10 hoặc SPECIAL20"
                  value={discountInput}
                  onChangeText={setDiscountInput}
                />
                <TouchableOpacity style={styles.applyBtn} onPress={handleApplyDiscount}>
                  <Text style={styles.btnText}>Áp dụng</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* --- TÓM TẮT ĐƠN HÀNG --- */}
            <View style={[styles.section, styles.summarySection]}>
              <Text style={styles.sectionTitle}>Tóm Tắt Hóa Đơn</Text>
              <View style={styles.summaryRow}>
                <Text>Tạm tính:</Text>
                <Text>${summary.subtotal.toFixed(2)}</Text>
              </View>
              {summary.discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.discountText}>Giảm giá:</Text>
                  <Text style={styles.discountText}>-${summary.discount.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text>Thuế (10%):</Text>
                <Text>${summary.tax.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text>Phí vận chuyển:</Text>
                <Text>${summary.shipping.toFixed(2)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalText}>Thành Tiền:</Text>
                <Text style={styles.totalText}>${summary.total.toFixed(2)}</Text>
              </View>
              <TouchableOpacity style={styles.checkoutBtn} onPress={() => Alert.alert("Thành công!", "Đơn hàng đã được thanh toán.")}>
                <Text style={styles.checkoutBtnText}>Thanh Toán Ngay</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// 6. BỌC PROVIDER
// ==========================================
export default function App() {
  return (
    <Provider store={store}>
      <ShoppingApp />
    </Provider>
  );
}

// ==========================================
// 7. STYLES
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  scrollContent: { padding: 15, paddingTop: 40, paddingBottom: 50 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#333' },
  section: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 },
  productCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  productInfo: { flex: 1, paddingRight: 10 },
  productName: { fontSize: 14, fontWeight: '600' },
  productPrice: { fontSize: 14, color: '#dc3545', marginTop: 5 },
  addBtn: { backgroundColor: '#0d6efd', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 5 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  emptyCart: { textAlign: 'center', fontStyle: 'italic', color: '#6c757d' },
  cartItem: { flexDirection: 'column', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f1f1', paddingBottom: 10 },
  cartItemName: { fontSize: 15, fontWeight: 'bold', flex: 1 },
  cartItemPrice: { fontSize: 14, color: '#dc3545', marginVertical: 5 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  qtyBtn: { backgroundColor: '#e9ecef', width: 30, height: 30, justifyContent: 'center', alignItems: 'center', borderRadius: 5 },
  qtyBtnText: { fontSize: 18, fontWeight: 'bold' },
  qtyText: { marginHorizontal: 15, fontSize: 16, fontWeight: 'bold' },
  removeBtn: { backgroundColor: '#dc3545', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 5, marginLeft: 'auto' },
  shippingOptions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  shipBtn: { flex: 1, padding: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginHorizontal: 2, alignItems: 'center' },
  shipActive: { backgroundColor: '#e0f3ff', borderColor: '#0d6efd' },
  shipText: { fontSize: 12, color: '#333' },
  shipActiveText: { color: '#0d6efd', fontWeight: 'bold' },
  discountBox: { flexDirection: 'row', marginTop: 10 },
  discountInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, paddingHorizontal: 10, marginRight: 10 },
  applyBtn: { backgroundColor: '#198754', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 5 },
  summarySection: { backgroundColor: '#fffbe6' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  discountText: { color: '#198754' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 10, marginTop: 10 },
  totalText: { fontSize: 18, fontWeight: 'bold', color: '#d63384' },
  checkoutBtn: { backgroundColor: '#0d6efd', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});