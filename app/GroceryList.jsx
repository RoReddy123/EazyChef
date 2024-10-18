import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Modal,
  TextInput,
  Button,
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  FlatList,
  Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format, startOfWeek, addDays } from 'date-fns';
import uuid from 'react-native-uuid';
import { db } from '../configs/FirebaseConfig';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore'; 
import { AuthContext } from '../components/AuthProvider';
import debounce from 'lodash.debounce';
import { searchIngredients, getAisle } from '../services/USDAService';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const GroceryList = () => {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const [groceryItems, setGroceryItems] = useState([]);
  const [customIngredients, setCustomIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');  // For the search input
  const [searchResults, setSearchResults] = useState([]);
  const [addedIngredients, setAddedIngredients] = useState([]);
  const [apiLimitReached, setApiLimitReached] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const today = new Date();
      const week = getCurrentWeek(today);
      fetchGroceryList(week);
      fetchCustomIngredients();
    } else {
      setLoading(false);
      setGroceryItems([]);
      setCustomIngredients([]);
    }
  }, [user]);

  const getCurrentWeek = (date) => {
    const start = startOfWeek(date, { weekStartsOn: 0 });
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(addDays(start, i));
    }
    return week;
  };

  const formatDateKey = (date) => format(date, 'yyyy-MM-dd');

  const fetchGroceryList = async (week) => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const startDate = formatDateKey(week[0]);
      const endDate = formatDateKey(week[6]);

      const mealPlanDocRef = doc(db, 'MealPlans', user.uid);
      const mealPlanDoc = await getDoc(mealPlanDocRef);

      if (!mealPlanDoc.exists()) {
        setGroceryItems([]);
        setLoading(false);
        return;
      }

      const mealPlanData = mealPlanDoc.data();
      const mealTypes = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack'];
      const recipeFrequencyMap = new Map();

      mealTypes.forEach((mealType) => {
        const recipes = mealPlanData[mealType] || [];
        recipes.forEach((recipe) => {
          const recipeDate = recipe.date;
          if (recipeDate >= startDate && recipeDate <= endDate) {
            if (recipe.recipeId) {
              const currentCount = recipeFrequencyMap.get(recipe.recipeId) || 0;
              recipeFrequencyMap.set(recipe.recipeId, currentCount + 1);
            }
          }
        });
      });

      if (recipeFrequencyMap.size === 0) {
        setGroceryItems([]);
        setLoading(false);
        return;
      }

      const uniqueRecipeIds = Array.from(recipeFrequencyMap.keys());
      const recipePromises = uniqueRecipeIds.map((id) => getDoc(doc(db, 'AllRecipes', id)));
      const recipeDocs = await Promise.all(recipePromises);

      const validRecipes = recipeDocs.filter(doc => doc.exists());

      if (validRecipes.length === 0) {
        setGroceryItems([]);
        setLoading(false);
        return;
      }

      const combinedIngredientsMap = new Map();

      for (const recipeDoc of validRecipes) {
        const recipeId = recipeDoc.id;
        const recipeData = recipeDoc.data();
        const frequency = recipeFrequencyMap.get(recipeId) || 1;
        const { ingredients } = recipeData;

        if (!Array.isArray(ingredients)) continue;

        for (const ingredient of ingredients) {
          if (!ingredient.name) continue;

          const normalizedDescription = ingredient.name.trim().toLowerCase();
          const normalizedUnit = ingredient.unit ? ingredient.unit.trim().toLowerCase() : '';
          const key = `${normalizedDescription}-${normalizedUnit}`;

          const quantity = parseFloat(ingredient.quantity);
          if (isNaN(quantity)) continue;

          const totalQuantity = quantity * frequency;

          if (combinedIngredientsMap.has(key)) {
            const existingIngredient = combinedIngredientsMap.get(key);
            existingIngredient.quantity += totalQuantity;
          } else {
            let aisle = 'Extras';
            try {
              aisle = await getAisle(ingredient.name);
            } catch (error) {
              console.error(`Error fetching aisle for ${ingredient.name}:`, error);
            }

            combinedIngredientsMap.set(key, {
              id: uuid.v4(),
              description: ingredient.name.trim(),
              quantity: totalQuantity,
              unit: ingredient.unit ? ingredient.unit.trim() : '',
              aisle: aisle,
              isCustom: false,
              checked: false,
            });
          }
        }
      }

      const combinedIngredients = Array.from(combinedIngredientsMap.values());
      setGroceryItems(combinedIngredients);
      setLoading(false);
    } catch (error) {
      console.error("Error in fetchGroceryList:", error);
      setLoading(false);
      Alert.alert('Error fetching grocery list', error.message);
    }
  };

  const fetchCustomIngredients = async () => {
    if (!user) return;

    try {
      const customIngredientsDocRef = doc(db, 'CustomIngredients', user.uid);
      const customIngredientsDoc = await getDoc(customIngredientsDocRef);

      if (customIngredientsDoc.exists()) {
        const customIngredientsData = customIngredientsDoc.data();
        const customIngs = customIngredientsData.ingredients || [];
        const updatedCustomIngs = await Promise.all(customIngs.map(async (ingredient) => {
          if (!ingredient.description) return null;

          const quantity = parseFloat(ingredient.quantity);
          if (isNaN(quantity)) return null;

          let aisle = 'Extras';
          try {
            aisle = await getAisle(ingredient.description);
          } catch (error) {
            console.error(`Error fetching aisle for ${ingredient.description}:`, error);
          }

          return {
            id: ingredient.id || uuid.v4(),
            description: ingredient.description.trim(),
            quantity: quantity,
            unit: ingredient.unit ? ingredient.unit.trim() : '',
            aisle: aisle,
            isCustom: ingredient.isCustom || true,
            checked: ingredient.checked || false,
          };
        }));

        const filteredCustomIngs = updatedCustomIngs.filter(ing => ing !== null);
        setCustomIngredients(filteredCustomIngs);
      } else {
        setCustomIngredients([]);
      }
    } catch (error) {
      console.error("Error in fetchCustomIngredients:", error);
      Alert.alert('Error fetching custom ingredients', error.message);
    }
  };

  const handleQueryChange = (text) => {
    setSearchQuery(text);
    debouncedSearch(text); // Handle debounced search query changes
  };

  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.length < 2 || apiLimitReached) {
        setSearchResults([]);
        return;
      }
  
      try {
        setSearchLoading(true);
        const results = await searchIngredients(query);
  
        const filteredResults = results.filter(result => {
          const description = result.description ? result.description.toLowerCase() : '';
          return !description.includes('quesadilla') && !description.includes('dish') && !description.includes('recipe');
        });
  
        if (Array.isArray(filteredResults)) {
          setSearchResults(filteredResults);
        } else {
          setSearchResults([]);
          console.error('Unexpected response format:', results);
          Alert.alert('Error', 'Unexpected response from the API');
        }
      } catch (error) {
        console.error('Error during ingredient search:', error);
  
        if (error.response?.status === 429) {
          setApiLimitReached(true);
          Alert.alert(
            'API Limit Reached',
            'You have reached the daily limit for ingredient searches. Please try again tomorrow.'
          );
        } else {
          Alert.alert('Error', error.message || 'An unexpected error occurred.');
        }
  
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500),
    [apiLimitReached]
  );

  const handleSelectSuggestion = (suggestion) => {
    const newIngredient = {
      id: suggestion.fdcId || uuid.v4(),
      description: suggestion.description || 'Unknown Ingredient',
      quantity: 1,
      unit: '',
      aisle: 'Extras',
      isCustom: true,
      checked: false,
    };

    setAddedIngredients([...addedIngredients, newIngredient]);
    setSearchResults([]);
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const saveCustomIngredients = async () => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    if (addedIngredients.length === 0) {
      Alert.alert('No Ingredients', 'Please add at least one ingredient.');
      return;
    }

    try {
      const customIngredientsDocRef = doc(db, 'CustomIngredients', user.uid);

      const ingredientsToAdd = await Promise.all(addedIngredients.map(async (ingredient) => {
        if (!ingredient.description) return null;

        let aisle = 'Extras';
        try {
          aisle = await getAisle(ingredient.description);
        } catch (error) {
          console.error(`Error fetching aisle for ${ingredient.description}:`, error);
        }

        return {
          id: ingredient.id,
          description: ingredient.description,
          quantity: ingredient.quantity,
          unit: ingredient.unit ? ingredient.unit.trim() : '',
          aisle: aisle,
          checked: ingredient.checked,
          isCustom: ingredient.isCustom,
        };
      }));

      const filteredIngredientsToAdd = ingredientsToAdd.filter(ing => ing !== null);

      if (filteredIngredientsToAdd.length === 0) {
        Alert.alert('No Valid Ingredients', 'All added ingredients are invalid.');
        return;
      }

      const customIngredientsDoc = await getDoc(customIngredientsDocRef);

      if (customIngredientsDoc.exists()) {
        await updateDoc(customIngredientsDocRef, {
          ingredients: arrayUnion(...filteredIngredientsToAdd),
        });
      } else {
        await setDoc(customIngredientsDocRef, {
          ingredients: filteredIngredientsToAdd,
        });
      }

      setCustomIngredients([...customIngredients, ...filteredIngredientsToAdd]);
      setAddedIngredients([]);
      setIsAddModalVisible(false);
    } catch (error) {
      console.error("Error saving custom ingredients:", error);
      Alert.alert('Error saving custom ingredients', error.message);
    }
  };

  const toggleCheckbox = (item) => {
    if (item.isCustom) {
      const updatedCustomIngredients = customIngredients.map(ingredient =>
        ingredient.id === item.id ? { ...ingredient, checked: !ingredient.checked } : ingredient
      );
      setCustomIngredients(updatedCustomIngredients);
    } else {
      const updatedGroceryItems = groceryItems.map(ingredient =>
        ingredient.id === item.id
          ? { ...ingredient, checked: !ingredient.checked }
          : ingredient
      );
      setGroceryItems(updatedGroceryItems);
    }
  };

  const getSections = () => {
    const sectionsMap = {};
    const allIngredients = [...groceryItems, ...customIngredients];

    allIngredients.forEach((item) => {
      const category = item.aisle || 'Extras';
      if (!sectionsMap[category]) {
        sectionsMap[category] = [];
      }
      sectionsMap[category].push(item);
    });

    const fixedOrder = [
      "Produce",
      "Meat and Seafood",
      "Dairy",
      "Frozen",
      "Snacks",
      "Bakery",
      "Beverages",
      "Extras"
    ];

    const sections = fixedOrder
      .filter(category => sectionsMap[category])
      .map((category) => ({
        title: category,
        data: sectionsMap[category],
      }));

    return sections;
  };

  const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const handleShareGroceryList = async () => {
    try {
      const groceryListId = uuid.v4(); // Generate a unique ID for the shared grocery list
  
      // Save the grocery list in Firestore with both groceryItems and customIngredients
      await setDoc(doc(db, 'SharedGroceryLists', groceryListId), {
        groceryItems: groceryItems || [],  // Ensure it's an array, even if empty
        customIngredients: customIngredients || [],  // Ensure it's an array, even if empty
        owner: user.uid,  // The user who is sharing the list
        createdAt: new Date().toISOString()  // Add a timestamp for tracking
      });
  
      // Generate the shareable link to the web page that displays the full grocery list
      const shareLink = `https://food-tinder-7f07d.web.app/grocerylist.html?groceryListId=${groceryListId}`;
  
      // Generate a preview text with the first few items from the grocery list
      const previewItems = [...groceryItems, ...customIngredients].slice(0, 3); // Limit preview to 3 items
      const previewText = previewItems.map(item => `${item.quantity || ''} ${item.unit || ''} ${item.description}`).join('\n');
  
      // Message that will be shared
      const message = `
        Here's a preview of my grocery list:
        ${previewText}
  
        Click here to see the full list:
        ${shareLink}
      `;
  
      // Use the native Share API to share the text and the link
      await Share.share({
        message: message,
      });
  
    } catch (error) {
      console.error('Error sharing grocery list:', error);
      Alert.alert('Error', 'Failed to share the grocery list.');
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#007bff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Grocery List</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" style={{ marginTop: 20 }} />
      ) : (
        <SectionList
          sections={getSections()}
          keyExtractor={(item) => item.id ? item.id.toString() : `${item.description || 'unknown'}-${item.unit || 'unknown'}`}
          renderItem={({ item }) => (
            <View style={styles.groceryItem}>
              <TouchableOpacity onPress={() => toggleCheckbox(item)}>
                <MaterialIcons
                  name={item.checked ? 'check-box' : 'check-box-outline-blank'}
                  size={24}
                  color="#007bff"
                />
              </TouchableOpacity>

              <View style={styles.ingredientDetails}>
                <Text
                  style={[
                    styles.groceryName,
                    item.checked && styles.crossedText // Add this line to conditionally apply cross-out style
                  ]}
                >
                  {item.description || 'Unknown Ingredient'}
                </Text>
                <Text
                  style={[
                    styles.groceryQuantity,
                    item.checked && styles.crossedText // Add this line to conditionally apply cross-out style
                  ]}
                >
                  {`${item.quantity || '0'} ${item.unit || ''}`.trim()}
                </Text>
              </View>

             
            </View>
          )}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text>No grocery items found.</Text>}
        />
      )}

      {/* Share Button */}
      <TouchableOpacity
        style={styles.shareButton}
        onPress={handleShareGroceryList}
      >
        <MaterialIcons name="share" size={28} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setIsAddModalVisible(true)}
      >
        <MaterialIcons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setIsAddModalVisible(false);
          setSearchQuery('');
          setSearchResults([]);
          setAddedIngredients([]);
        }}
      >
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Search and Add Ingredients</Text>

              <TextInput
                style={styles.inputModal}
                placeholder="Search for an ingredient"
                value={searchQuery}
                onChangeText={handleQueryChange}
              />

              {Array.isArray(searchResults) && searchResults.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {searchLoading ? (
                    <ActivityIndicator size="small" color="#007bff" />
                  ) : (
                    <ScrollView keyboardShouldPersistTaps="handled">
                      {searchResults.map((item) => (
                        <TouchableOpacity
                          key={item.fdcId || uuid.v4()}
                          onPress={() => handleSelectSuggestion(item)}
                          style={styles.suggestionItem}
                        >
                          <Text>{item.description || 'Unknown'}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}
              <FlatList
                data={addedIngredients}
                keyExtractor={(item) => item.id || uuid.v4()}
                renderItem={({ item }) => (
                  <View style={styles.groceryItem}>
                    <MaterialIcons
                      name={item.checked ? 'check-box' : 'check-box-outline-blank'}
                      size={24}
                      color="#007bff"
                    />
                    <View style={styles.ingredientDetails}>
                      <Text style={styles.groceryName}>{item.description || 'Unknown Name'}</Text>
                      <Text style={styles.groceryQuantity}>
                        {`${item.quantity || '0'} ${item.unit || ''}`.trim()}
                      </Text>
                    </View>
                  </View>
                )}
              />

              <View style={styles.modalButtons}>
                <Button title="Save Ingredients" onPress={saveCustomIngredients} />
                <Button title="Cancel" onPress={() => setIsAddModalVisible(false)} />
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  listContainer: {
    paddingBottom: 20,
  },
  sectionHeader: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ingredientDetails: {
    marginLeft: 10,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groceryName: {
    fontSize: 16,
    color: '#333',
  },
  groceryQuantity: {
    fontSize: 16,
    color: '#555',
  },
  addButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#28a745',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  shareButton: {
    position: 'absolute',
    bottom: 100,
    right: 30,
    backgroundColor: '#007bff',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width - 40,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 15,
    textAlign: 'center',
  },
  inputModal: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  suggestionsContainer: {
    maxHeight: 150,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 10,
  },
  suggestionItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  crossedText: {
    textDecorationLine: 'line-through', // Add this line for crossing out text
    color: '#888', // Optionally change the color for checked-off items
  },
});

export default GroceryList;
