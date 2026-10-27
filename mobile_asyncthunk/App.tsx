import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  FlatList, ActivityIndicator, Alert, SafeAreaView, Platform
} from 'react-native';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { configureStore, createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// --- 1. KIỂU DỮ LIỆU (TYPESCRIPT) ---
interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

interface PostsState {
  items: Post[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const API_URL = 'https://jsonplaceholder.typicode.com/posts';

// --- 2. ASYNC THUNKS (GỌI API) ---
// Lấy danh sách bài viết
export const fetchPosts = createAsyncThunk('posts/fetchPosts', async () => {
  const response = await fetch(`${API_URL}?_limit=10`);
  if (!response.ok) throw new Error('Lỗi lấy dữ liệu');
  return (await response.json()) as Post[];
});

// Thêm bài viết
export const addPost = createAsyncThunk('posts/addPost', async (newPost: Omit<Post, 'id'>) => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPost),
  });
  const data = await response.json();
  // VÁ LỖI: Gán ID ảo bằng Date.now() để render trên UI không bị trùng
  return { ...data, id: Date.now() } as Post; 
});

// Cập nhật bài viết
export const updatePost = createAsyncThunk('posts/updatePost', async (post: Post) => {
  try {
    const response = await fetch(`${API_URL}/${post.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post),
    });
    if (!response.ok) throw new Error('Server từ chối ID ảo');
    return (await response.json()) as Post;
  } catch (error) {
    // VÁ LỖI: Trả về chính dữ liệu bạn vừa sửa để Redux cập nhật UI nội bộ (bỏ qua lỗi server)
    return post;
  }
});

// Xóa bài viết
export const deletePost = createAsyncThunk('posts/deletePost', async (id: number) => {
  try {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  } catch (error) {
    // VÁ LỖI: Bỏ qua lỗi server từ chối ID ảo khi xóa bài viết mới thêm
  }
  // Luôn trả về ID để reducer biết đường xóa khỏi giao diện
  return id; 
});

// --- 3. REDUX SLICE ---
const initialState: PostsState = {
  items: [],
  status: 'idle',
  error: null,
};

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Xử lý Lấy danh sách (READ)
      .addCase(fetchPosts.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchPosts.fulfilled, (state, action: PayloadAction<Post[]>) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Lỗi không xác định';
      })
      
      // Xử lý Thêm mới (CREATE)
      .addCase(addPost.fulfilled, (state, action: PayloadAction<Post>) => {
        state.items.unshift(action.payload);
      })
      
      // Xử lý Cập nhật (UPDATE)
      .addCase(updatePost.fulfilled, (state, action: PayloadAction<Post>) => {
        const index = state.items.findIndex((p) => p.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload; // Ép mảng lấy dữ liệu mới sửa
        }
      })
      
      // Xử lý Xóa (DELETE)
      .addCase(deletePost.fulfilled, (state, action: PayloadAction<number>) => {
        // Dùng splice để xóa phần tử an toàn
        const index = state.items.findIndex((p) => p.id === action.payload);
        if (index !== -1) {
          state.items.splice(index, 1);
        }
      });
  },
});

// --- 4. REDUX STORE ---
const store = configureStore({
  reducer: {
    posts: postsSlice.reducer,
  },
});

type RootState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

// --- 5. COMPONENT GIAO DIỆN ---
function PostManager() {
  const dispatch = useDispatch<AppDispatch>();
  const { items: posts, status, error } = useSelector((state: RootState) => state.posts);
  
  const [title, setTitle] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchPosts());
    }
  }, [status, dispatch]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    
    try {
      if (editingId) {
        await dispatch(updatePost({ id: editingId, title, body: 'Nội dung cập nhật', userId: 1 })).unwrap();
      } else {
        await dispatch(addPost({ title, body: 'Nội dung mới', userId: 1 })).unwrap();
      }
      setTitle('');
      setEditingId(null);
    } catch (err) {
      Alert.alert('Lỗi', 'Thao tác thất bại');
    }
  };

  const startEdit = (post: Post) => {
    setEditingId(post.id);
    setTitle(post.title);
  };

  const handleDelete = (id: number) => {
    // Phân biệt môi trường Web và Mobile để hiện thông báo xác nhận chính xác
    if (Platform.OS === 'web') {
      if (window.confirm('Bạn có chắc muốn xóa?')) {
        dispatch(deletePost(id));
      }
    } else {
      Alert.alert('Xác nhận', 'Bạn có chắc muốn xóa?', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xóa', style: 'destructive', onPress: () => dispatch(deletePost(id)) }
      ]);
    }
  };

  const renderItem = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(item)}>
          <Text style={styles.btnText}>Sửa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
          <Text style={styles.btnText}>Xóa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>CRUD Redux Toolkit</Text>
      
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Nhập tiêu đề..."
          value={title}
          onChangeText={setTitle}
        />
        <TouchableOpacity 
          style={[styles.submitBtn, editingId ? styles.updateBtn : null]} 
          onPress={handleSubmit}
        >
          <Text style={styles.submitBtnText}>
            {editingId ? "Cập Nhật" : "Thêm"}
          </Text>
        </TouchableOpacity>
        
        {editingId && (
          <TouchableOpacity 
            style={styles.cancelBtn} 
            onPress={() => { setEditingId(null); setTitle(''); }}
          >
            <Text style={styles.btnText}>Hủy</Text>
          </TouchableOpacity>
        )}
      </View>

      {status === 'loading' ? (
        <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />
      ) : status === 'failed' ? (
        <Text style={styles.errorText}>Lỗi: {error}</Text>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

// --- 6. ỨNG DỤNG CHÍNH ---
export default function App() {
  return (
    <Provider store={store}>
      <PostManager />
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 15, paddingTop: 40 },
  header: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginVertical: 10 },
  form: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, gap: 10 },
  input: { flex: 1, minWidth: '50%', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  submitBtn: { backgroundColor: '#28a745', padding: 12, borderRadius: 8, justifyContent: 'center' },
  updateBtn: { backgroundColor: '#ffc107' },
  cancelBtn: { backgroundColor: '#6c757d', padding: 12, borderRadius: 8, justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold' },
  btnText: { color: '#fff' },
  postCard: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, elevation: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  postTitle: { flex: 1, fontSize: 16, marginRight: 10 },
  actionButtons: { flexDirection: 'row', gap: 5 },
  editBtn: { backgroundColor: '#17a2b8', padding: 8, borderRadius: 5 },
  deleteBtn: { backgroundColor: '#dc3545', padding: 8, borderRadius: 5 },
  errorText: { color: 'red', textAlign: 'center' }
});