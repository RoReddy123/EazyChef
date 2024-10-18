import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  ActivityIndicator, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView 
} from 'react-native';
import Header from '../../app/Header'; // Ensure correct path
import Search from '../../components/Recipe/Search';
import GridScreen from '../../components/Recipe/GridScreen'; // Ensure correct path
import PopularGrid from '../../components/Recipe/PopularItems'; // Ensure correct path
import FavoriteSlider from '../../components/Recipe/FavoriteSlider'; // Ensure correct path
import { collection, getDocs } from 'firebase/firestore';
import { db } from './../../configs/FirebaseConfig';
import { Ionicons } from '@expo/vector-icons'; // Import icons from Expo

const RecipePage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allRecipes, setAllRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all recipes from Firestore on component mount
  useEffect(() => {
    const fetchAllRecipes = async () => {
      setIsLoading(true);
      try {
        const recipeSnapshot = await getDocs(collection(db, 'AllRecipes'));
        const recipes = recipeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Debugging: Log recipes with missing fields
        recipes.forEach(recipe => {
          if (!recipe.title) {
            console.warn(`Recipe with ID ${recipe.id} is missing the 'title' field.`);
          }
          if (!recipe.ingredients) {
            console.warn(`Recipe with ID ${recipe.id} is missing the 'ingredients' field.`);
          }
          if (!recipe.imageUrl) {
            console.warn(`Recipe with ID ${recipe.id} is missing the 'imageUrl' field.`);
          }
        });

        setAllRecipes(recipes);
        setSearchResults([]);
      } catch (error) {
        console.error("Error fetching recipes: ", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllRecipes();
  }, []);

  // Handle search input changes
  const handleSearch = (queryText) => {
    setSearchQuery(queryText);

    if (queryText.trim().length > 0) { // Trim to avoid searching for spaces
      const lowerCaseQuery = queryText.toLowerCase();

      const filteredRecipes = allRecipes.filter(recipe => {
        // Check if recipe.title exists and is a string
        const titleMatches = typeof recipe.title === 'string' 
          ? recipe.title.toLowerCase().includes(lowerCaseQuery) 
          : false;

        // Prepare ingredientsList
        let ingredientsList = [];
        if (Array.isArray(recipe.ingredients)) {
          ingredientsList = recipe.ingredients;
        } else if (typeof recipe.ingredients === 'string') {
          ingredientsList = recipe.ingredients.split(',').map(ing => ing.trim());
        }

        // Check if any ingredient matches
        const ingredientsMatch = ingredientsList.some(ingredient => 
          typeof ingredient === 'string' 
            ? ingredient.toLowerCase().includes(lowerCaseQuery) 
            : false
        );

        return titleMatches || ingredientsMatch;
      });

      setSearchResults(filteredRecipes);
    } else {
      setSearchResults([]);
    }
  };

  // Handle canceling the search
  const handleCancel = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  // Define the renderItem for FlatList (used for search results)
  const renderItem = ({ item }) => (
    <View style={styles.recipeItem}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.recipeImage} />
      ) : (
        <View style={[styles.recipeImage, styles.placeholder]}>
          <Text style={styles.placeholderText}>No Image</Text>
        </View>
      )}
      <Text style={styles.recipeName}>{item.title || 'Unnamed Recipe'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Render Header */}
      <Header title="Recipes" />

      {/* Search Bar */}
      <Search 
        searchQuery={searchQuery} 
        onChangeText={handleSearch} 
        onCancel={handleCancel} 
      />

      {/* Loading Indicator */}
      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      ) : (
        searchQuery.trim().length > 0 ? (
          // Render FlatList for search results
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            numColumns={2}
            renderItem={renderItem}
            ListEmptyComponent={
              <Text style={styles.noResultsText}>
                No recipes found for "{searchQuery}"
              </Text>
            }
            contentContainerStyle={
              searchResults.length === 0 && styles.emptyListContainer
            }
          />
        ) : (
          // Render main content when not searching inside a ScrollView
          <ScrollView 
            contentContainerStyle={styles.mainContent}
            showsVerticalScrollIndicator={false}
            >
            {/* Categories */}
            <GridScreen />

            {/* Popular Items */}
            <PopularGrid />

            {/* Favorites */}
            <FavoriteSlider />
          </ScrollView>
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F8FF', // Optional: Set a background color
  },
  recipeItem: {
    flex: 1,
    margin: 10,
    alignItems: 'center',
    maxWidth: '48%', // To ensure two items per row with some spacing
  },
  recipeImage: {
    width: 150,
    height: 150,
    borderRadius: 10,
    marginBottom: 5,
  },
  placeholder: {
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
  },
  recipeName: { // Keeping original style name
    fontSize: 16,
    textAlign: 'center',
  },
  noResultsText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#333',
  },
  loader: {
    marginTop: 50,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  mainContent: {
    paddingBottom: 20, // Optional: Add padding to avoid content being hidden behind tabs or other UI elements
  },
});

export default RecipePage;
