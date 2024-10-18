import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  FlatList, 
  Dimensions,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, getDoc, doc } from 'firebase/firestore'; // Added getDoc and doc
import { db } from './../../configs/FirebaseConfig'; // Firebase config
import RecipeModal from '../../app/RecipeModal'; // Modal for recipe details
import { AuthContext } from './../AuthProvider'; // Context for authentication

const SCREEN_HEIGHT = Dimensions.get('window').height;

const FavoriteSlider = () => {
  const router = useRouter();
  const { user, authLoading } = useContext(AuthContext); // Access the authenticated user and loading state
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeLoading, setRecipeLoading] = useState(false); // New loading state for recipes

  useEffect(() => {
    let unsubscribe;

    const listenToFavorites = () => {
      if (!user) {
        setLoading(false);
        setFavorites([]);
        return;
      }

      try {
        // Collection reference for the user's favorites
        const favoritesCollection = collection(db, 'Favorites', user.uid, 'UserFavorites');

        // Real-time listener for Firestore data
        unsubscribe = onSnapshot(favoritesCollection, (querySnapshot) => {
          const items = querySnapshot.docs.map((doc) => ({
            id: doc.id,  // Document ID (could be the recipeId)
            ...doc.data() // Get the fields (e.g., title, imageUrl, recipeId)
          }));

          console.log('Real-time Favorites for User:', user.uid, items);

          setFavorites(items);
          setLoading(false);
        }, (error) => {
          console.error('Error listening to favorites: ', error);
          Alert.alert('Error', 'Failed to listen to favorites. Please try again later.');
          setLoading(false);
        });
      } catch (error) {
        console.error('Error setting up listener for favorites: ', error);
        Alert.alert('Error', 'Failed to set up favorites listener.');
        setLoading(false);
      }
    };

    listenToFavorites();

    // Cleanup listener on unmount or when user changes
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  // **New Function: Fetch Recipe by ID**
  const fetchRecipeById = async (recipeId) => {
    try {
      const recipeDocRef = doc(db, 'AllRecipes', recipeId);
      const recipeSnapshot = await getDoc(recipeDocRef);
      if (recipeSnapshot.exists()) {
        return recipeSnapshot.data(); // Return full recipe data
      } else {
        console.error(`Recipe with ID ${recipeId} not found`);
        return null;
      }
    } catch (error) {
      console.error('Error fetching recipe:', error);
      return null;
    }
  };

  // Function to open modal with selected recipe
  const openModal = async (recipe) => {
    if (!recipe || !recipe.recipeId) { // Ensure recipeId exists
      console.warn("Recipe has missing 'recipeId':", recipe);
      Alert.alert("Incomplete Data", "This recipe does not have a valid identifier.");
      return;
    }

    setRecipeLoading(true); // Start loading
    const fullRecipe = await fetchRecipeById(recipe.recipeId); // Fetch full recipe details

    if (fullRecipe) {
      setSelectedRecipe(fullRecipe);
      setModalVisible(true);
    } else {
      Alert.alert("Error", "Failed to fetch recipe details.");
    }
    setRecipeLoading(false); // End loading
  };

  // Function to close modal
  const closeModal = () => {
    setModalVisible(false);
    setSelectedRecipe(null);
  };

  // Rendering each favorite recipe
  const renderItem = ({ item }) => {
    const recipe = item; // Here, item contains the recipeId, title, imageUrl, etc.

    // Ensure that the recipe has the required fields
    if (!recipe.title || !recipe.imageUrl) {
      console.warn(`Favorite item with ID ${item.id} is missing 'imageUrl' or 'title'.`, recipe);
      return null; // Skip rendering this item if data is incomplete
    }

    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => openModal(recipe)} // Open modal on press
        accessibilityLabel={`View details for ${recipe.title}`}
        accessible={true}
      >
        <Image source={{ uri: recipe.imageUrl }} style={styles.cardImage} />
        <View style={styles.cardTitleContainer}>
          <Text style={styles.title}>{recipe.title}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />;
  }

  if (favorites.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>You have no favorite recipes yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <Text style={styles.sectionTitle}>Favorite Items</Text>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id} // Each favorite item has a unique ID
        renderItem={renderItem}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sliderContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Reusable Modal Component */}
      <RecipeModal
        visible={modalVisible}
        onClose={closeModal}
        recipe={selectedRecipe}
        loading={recipeLoading} // Pass loading state to RecipeModal
      />
    </View>
  );
};

// Helper function to capitalize first letter (optional if needed)
const capitalizeFirstLetter = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const styles = StyleSheet.create({
  screenContainer: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#F0F8FF', // Optional: Add background color for consistency
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'outfit-bold', // Ensure this font is available or use a standard font
    color: 'black',
    textAlign: 'left',
    marginTop: 20,
    paddingLeft: 10,
    marginBottom: 10,
  },
  sliderContent: {
    paddingLeft: 10,
    paddingRight: 10,
  },
  separator: {
    width: 10, // Space between items
  },
  card: {
    width: 150, // Adjust as needed
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 100,
  },
  cardTitleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  title: {
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
  },
  loader: {
    marginTop: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#F0F8FF', // Match background color
  },
});

export default FavoriteSlider;
