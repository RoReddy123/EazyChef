import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Modal, 
  FlatList, 
  TextInput, 
  Keyboard, 
  TouchableWithoutFeedback, 
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Import Ionicons for icons
import { useRouter } from 'expo-router';
import { 
  collection, 
  getDocs, 
  query as firestoreQuery, 
  where, 
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './../../configs/FirebaseConfig'; // Adjust path as needed

import { AuthContext } from './../AuthProvider'; // Ensure correct path

import RecipeModal from '../../app/RecipeModal'; // Import the RecipeModal component

// **Separate and Memoize the RecipeItem Component**
const RecipeItem = React.memo(({ item, onPress }) => {
  const title = item.title || "No Title Available"; // Default fallback for title
  const imageUrl = item.imageUrl || 'https://via.placeholder.com/150'; // Default fallback for image URL

  if (item.id.startsWith('placeholder')) {
    return <View style={styles.placeholderCard} />;
  }

  return (
    <TouchableOpacity 
      style={styles.recipeItemWrapper} 
      onPress={() => onPress(item)}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${title}`}
      accessibilityHint={`Opens details for ${title}`}
    >
      <View style={styles.recipeCard}>
        <Image 
          source={{ uri: imageUrl }} 
          style={styles.recipeImage} 
          resizeMode="cover"
          onError={(e) => console.log("Image loading error:", e.nativeEvent.error)}
        />
        <View style={styles.recipeTitleContainer}>
          <Text style={styles.recipeTitle}>{title}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const GridScreen = () => {
  const router = useRouter();
  const { user } = useContext(AuthContext); // Get the current user
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null); // Track selected category
  const [categoryRecipes, setCategoryRecipes] = useState([]); // Store recipes for selected category
  const [filteredRecipes, setFilteredRecipes] = useState([]); // Filtered recipes based on search
  const [searchQuery, setSearchQuery] = useState(''); // Store the search query
  const [modalVisible, setModalVisible] = useState(false); // Control category modal visibility
  const [recipesLoading, setRecipesLoading] = useState(false); // Control loading for recipes

  // State for Recipe Modal
  const [isRecipeModalVisible, setIsRecipeModalVisible] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = firestoreQuery(collection(db, 'CategoriesGrid')); // Fetch categories
        const querySnapshot = await getDocs(q);
        const categories = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Log fetched categories for debugging
        console.log("Fetched Categories:", categories);

        if (categories.length > 0 && categories[0].title) {
          const sortedCategories = categories.sort((a, b) => a.title.localeCompare(b.title));
          setData(sortedCategories);
        } else {
          setData(categories);
          console.warn("No 'title' field found in categories.");
        }

      } catch (error) {
        console.error("Error fetching categories: ", error);
        Alert.alert("Error", "Failed to fetch categories. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const fetchCategoryRecipes = async (categoryName) => {
    try {
      setRecipesLoading(true);
      const q = firestoreQuery(collection(db, 'AllRecipes'), where('category', '==', categoryName));
      const querySnapshot = await getDocs(q);
      
      const fetchedRecipes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log("Fetched recipes for category:", categoryName, fetchedRecipes);

      // Filter incomplete recipes and log them
      const incompleteRecipes = fetchedRecipes.filter(recipe => !recipe.title?.trim() || !recipe.imageUrl?.trim());
      if (incompleteRecipes.length > 0) {
        console.warn("Some recipes are missing 'title' or 'imageUrl':", incompleteRecipes);
      }

      setCategoryRecipes(fetchedRecipes);
      setFilteredRecipes(fetchedRecipes);
    } catch (error) {
      console.error("Error fetching category recipes: ", error);
      Alert.alert("Error", "Failed to fetch recipes for this category. Please try again later.");
    } finally {
      setRecipesLoading(false);
    }
  };

  const handleCategoryPress = async (categoryName) => {
    console.log("Category Pressed:", categoryName);
    setSelectedCategory(categoryName);
    await fetchCategoryRecipes(categoryName);
    setModalVisible(true);
  };

  const handleRecipePress = (recipe) => {
    console.log("Recipe Pressed:", recipe);
    setSelectedRecipe(recipe);
    setIsRecipeModalVisible(true);
  };

  const handleSaveRecipe = async () => {
    if (!user) {
      Alert.alert("Authentication Required", "You need to be logged in to save recipes.");
      return;
    }

    try {
      const q = firestoreQuery(
        collection(db, 'Favorites'),
        where('userId', '==', user.uid),
        where('recipe.id', '==', selectedRecipe.id) // Assuming each recipe has a unique 'id'
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        Alert.alert("Already Saved", "You have already saved this recipe.");
        return;
      }

      // Save the recipe to Favorites
      await addDoc(collection(db, 'Favorites'), {
        userId: user.uid,
        recipe: selectedRecipe,
        savedAt: serverTimestamp(),
      });
      Alert.alert("Success", "Recipe saved successfully!");
    } catch (error) {
      console.error("Error saving recipe: ", error);
      Alert.alert("Error", "Failed to save recipe. Please try again.");
    }
  };

  const addPlaceholder = (recipes) => {
    if (recipes.length % 2 !== 0) {
      return [...recipes, { id: `placeholder-${Date.now()}` }];
    }
    return recipes;
  };

  const renderRecipeItem = ({ item }) => (
    <RecipeItem item={item} onPress={handleRecipePress} />
  );

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredRecipes(categoryRecipes);
    } else {
      const filtered = categoryRecipes.filter((recipe) =>
        recipe.title.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredRecipes(filtered);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredRecipes(categoryRecipes);
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading Categories...</Text>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>No categories found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <Text style={styles.sectionTitle}>Categories</Text>
      <View style={styles.grid}>
        {data.map((item) => {
          if (!item.image) {
            console.warn(`Category with ID ${item.id} is missing 'image'.`);
          }
          return (
            <TouchableOpacity 
              key={item.id} 
              style={styles.card} 
              onPress={() => handleCategoryPress(item.title)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${item.title}`}
              accessibilityHint={`Opens recipes for ${item.title}`}
            >
              <Image 
                source={{ uri: item.image || 'https://via.placeholder.com/100' }} 
                style={styles.cardImage} 
                resizeMode="cover"
                onError={(e) => console.log("Image loading error:", e.nativeEvent.error)}
              />
              <View style={styles.cardTitleContainer}>
                <Text style={styles.title}>{item.title}</Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Category Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Recipes for {selectedCategory}</Text>

          {/* Search Bar for Filtering Recipes */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="gray" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search recipes..."
                value={searchQuery}
                onChangeText={handleSearch}
                onSubmitEditing={dismissKeyboard}
                returnKeyType="done"
                accessible={true}
                accessibilityLabel="Search recipes"
                accessibilityHint="Enter text to search for recipes"
              />
              {/* Show X icon only when there's something in the search bar */}
              {searchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={clearSearch} 
                  style={styles.clearButton}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search input"
                  accessibilityHint="Clears the search input field"
                >
                  <Ionicons name="close-circle" size={24} color="gray" />
                </TouchableOpacity>
              )}
            </View>
          </TouchableWithoutFeedback>

          {recipesLoading ? (
            <View style={styles.recipesLoaderContainer}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text style={styles.loadingText}>Loading Recipes...</Text>
            </View>
          ) : (
            <View style={styles.flatListContainer}>
              <FlatList
                data={addPlaceholder(filteredRecipes)}
                keyExtractor={(item, index) => item.id.startsWith('placeholder') ? `placeholder-${index}` : item.id}
                numColumns={2} 
                columnWrapperStyle={styles.columnWrapperStyle}
                renderItem={renderRecipeItem}
                ListEmptyComponent={<Text style={styles.noRecipesText}>No recipes found for this category.</Text>}
                contentContainerStyle={filteredRecipes.length === 0 && styles.emptyList}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={21}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
              />
            </View>
          )}
          
          <TouchableOpacity 
            onPress={() => setModalVisible(false)} 
            style={styles.closeCategoryModalButton}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Close recipes modal"
            accessibilityHint="Closes the recipes list modal"
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>

          {/* Nested Recipe Modal */}
          <RecipeModal 
            visible={isRecipeModalVisible} 
            onClose={() => setIsRecipeModalVisible(false)} 
            recipe={selectedRecipe} 
            onSave={handleSaveRecipe} 
          />
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    paddingHorizontal: 0,
    paddingVertical: 10,
    flex: 1,
    backgroundColor: '#F0F8FF',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'left',
    marginTop: 10,
    paddingLeft: 10,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  card: {
    width: '30%',
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',  // Black shadow color for good contrast
    shadowOffset: { width: 0, height: 0 },  // Ensures shadow is evenly distributed all around
    shadowOpacity: 0.2,   // Lower opacity for a more subtle shadow
    shadowRadius: 5,      // Larger radius to spread the shadow softly
    elevation: 6,         // For Android, this helps with shadow visibility all around
    overflow: 'hidden',   // Ensures content stays within rounded corners
  },  
  cardImage: {
    width: '100%',
    height: 100,
  },
  cardTitleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  title: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noDataText: {
    fontSize: 18,
    color: '#555',
  },
  modalContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 20,
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 10,
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    marginHorizontal: 10,
    marginBottom: 20,
    paddingLeft: 10,
    paddingRight: 10,
    paddingVertical: 5,
    backgroundColor: '#f9f9f9',
  },
  searchIcon: {
    marginRight: 5,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
  },
  clearButton: {
    paddingHorizontal: 10,
  },
  flatListContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeItemWrapper: {
    paddingHorizontal: 5,
    flex: 1,
  },
  recipeCard: {
    flex: 1,
    marginBottom: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    elevation: 3,
    overflow: 'hidden',
    padding: 5,
  },
  recipeTitleContainer: {
    backgroundColor: '#fff',
    padding: 8,
    borderTopWidth: 1,
    paddingHorizontal: 10,
    borderTopColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  recipeImage: {
    width: '100%',
    height: 150,
  },
  placeholderCard: {
    flex: 1,
    paddingHorizontal: 5,
    marginBottom: 15,
    backgroundColor: 'transparent',
  },
  closeCategoryModalButton: {
    marginTop: 10,
    alignItems: 'center',
    backgroundColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 20,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  columnWrapperStyle: {
    justifyContent: 'space-between',
    marginHorizontal: 0,
  },
  recipesLoaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noRecipesText: {
    fontSize: 18,
    color: '#555',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default GridScreen;
