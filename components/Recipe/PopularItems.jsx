// PopularGrid.js

import { 
    View, 
    Text, 
    Image, 
    TouchableOpacity, 
    StyleSheet, 
    Modal, 
    Dimensions, 
    ScrollView, 
    ActivityIndicator, 
    Alert 
  } from 'react-native';
  import React, { useState, useEffect, useContext } from 'react';
  import { useRouter } from 'expo-router';
  import { collection, getDocs, query, addDoc, where, doc, getDoc } from 'firebase/firestore';
  import { db } from './../../configs/FirebaseConfig'; // Adjust the path as needed
  import { AntDesign } from '@expo/vector-icons';
  import { AuthContext } from './../AuthProvider'; // Ensure correct path
  
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  
  const PopularGrid = () => {
    const router = useRouter();
    const { user } = useContext(AuthContext); // Get the current user
    const [data, setData] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(true); // Added loading state
  
    // Fetch data from Firestore
    useEffect(() => {
      const fetchData = async () => {
        try {
          const q = query(collection(db, 'PopularItems')); // Adjust 'PopularItems' to your collection name
          const querySnapshot = await getDocs(q);
          const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setData(items);
        } catch (error) {
          console.error("Error fetching data: ", error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }, []);
  
    // Function to open the modal with selected item details
    const openModal = (item) => {
      setSelectedItem(item);
      setModalVisible(true);
    };
  
    // Function to close the modal
    const closeModal = () => {
      setModalVisible(false);
      setSelectedItem(null);
    };
  
    // Function to handle adding an item to favorites
    const addToFavorites = async () => {
      if (!user) {
        Alert.alert("Authentication Required", "Please log in to save favorites.");
        return;
      }
  
      try {
        // Check if the favorite already exists to prevent duplicates
        const favoritesRef = collection(db, 'Favorites');
        const q = query(
          favoritesRef,
          where('userId', '==', user.uid),
          where('recipeId', '==', selectedItem.id)
        );
        const querySnapshot = await getDocs(q);
  
        if (!querySnapshot.empty) {
          Alert.alert("Already Saved", "This recipe is already in your favorites.");
          return;
        }
  
        // Add the recipe to the Favorites collection
        await addDoc(favoritesRef, {
          userId: user.uid,
          recipeId: selectedItem.id,
          title: selectedItem.title,
          imageUrl: selectedItem.image,
          name: selectedItem.name || '',
          createdAt: new Date(),
        });
  
        Alert.alert("Success", "Recipe added to your favorites!");
      } catch (error) {
        console.error("Error adding to favorites: ", error);
        Alert.alert("Error", "There was an error adding the recipe to your favorites.");
      }
    };
  
    // Function to handle navigation if needed (currently unused)
    const handlePress = (route) => {
      router.navigate(`/${route}`);
    };
  
    if (loading) {
      return <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />;
    }
  
    if (data.length === 0) {
      return (
        <View style={styles.container}>
          <Text>No popular items found.</Text>
        </View>
      );
    }
  
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.sectionTitle}>Popular Items</Text>
        <View style={styles.grid}>
          {data.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.card} 
              onPress={() => openModal(item)} // Open modal on press
            >
              <Image source={{ uri: item.image }} style={styles.cardImage} />
              <View style={styles.cardTitleContainer}>
                <Text style={styles.title}>{item.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
  
        {/* Modal for displaying detailed recipe/item info */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={closeModal}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.header}>
                <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                  <AntDesign name="closecircle" size={24} color="black" />
                </TouchableOpacity>
                <Text style={styles.recipeTitle}>
                  {selectedItem?.title || 'Recipe Title'}
                </Text>
              </View>
              <ScrollView 
                style={{ flexGrow: 1 }} 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ paddingBottom: 30 }}
              >
                <Image
                  source={{ uri: selectedItem?.image }}
                  style={styles.modalRecipeImage}
                />
                <Text style={styles.recipeText}>
                  {selectedItem?.name || 'name not available.'}
                </Text>
  
                {/* Render Ingredients if available */}
                {selectedItem?.ingredients && (
                  <>
                    <Text style={styles.ingredientsTitle}>Ingredients:</Text>
                    <View style={styles.ingredientsList}>
                      {selectedItem.ingredients.map((ingredient, index) => (
                        <Text key={index} style={styles.ingredientItem}>
                          - {ingredient}
                        </Text>
                      ))}
                    </View>
                  </>
                )}
  
                {/* Render Instructions if available */}
                {selectedItem?.instructions && (
                  <>
                    <Text style={styles.instructionsTitle}>Instructions:</Text>
                    <View style={styles.instructionsList}>
                      {selectedItem.instructions.map((instruction, index) => (
                        <Text key={index} style={styles.instructionItem}>
                          {index + 1}. {instruction}
                        </Text>
                      ))}
                    </View>
                  </>
                )}
              </ScrollView>
  
              {/* Button to Add to Favorites */}
              <TouchableOpacity style={styles.favoriteButton} onPress={addToFavorites}>
                <AntDesign name="hearto" size={24} color="#fff" />
                <Text style={styles.favoriteButtonText}>Add to Favorites</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  };
  
  const styles = StyleSheet.create({
    screenContainer: {
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    sectionTitle: {
      fontSize: 18,
      fontFamily: 'outfit-bold', // Ensure this font is available or use a standard font
      color: 'black',
      textAlign: 'left',
      paddingLeft: 10,
      marginBottom: 5,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    card: {
      width: '48%', // Adjust width to fit 2 items per row with spacing
      marginBottom: 20,
      backgroundColor: 'white',
      borderRadius: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 5,
      overflow: 'hidden', // Ensure the content stays within the card bounds
    },
    cardImage: {
      width: '100%',
      height: 100,
    },
    cardTitleContainer: {
      justifyContent: 'center', // Center vertically
      alignItems: 'center', // Center horizontally
      padding: 10,
    },
    title: {
      textAlign: 'center',
      fontSize: 14,
    },
    // Modal Styles
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
      backgroundColor: 'white',
      padding: 15,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: SCREEN_HEIGHT * 0.9, // Modal height covers more of the screen
    },
    closeButton: {
      alignSelf: 'flex-end',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    recipeTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 5,
      marginTop: 5,
      flex: 1,
      textAlign: 'center',
    },
    modalRecipeImage: {
      width: '100%',
      height: 250,
      borderRadius: 10,
      marginBottom: 20,
    },
    recipeText: {
      fontSize: 16,
      marginBottom: 10,
    },
    ingredientsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 10,
    },
    ingredientsList: {
      marginBottom: 20,
    },
    ingredientItem: {
      fontSize: 16,
      marginVertical: 2,
    },
    instructionsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 10,
    },
    instructionsList: {
      marginBottom: 20,
    },
    instructionItem: {
      fontSize: 16,
      marginVertical: 2,
    },
    loader: {
      marginTop: 50,
    },
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    favoriteButton: {
      flexDirection: 'row',
      backgroundColor: '#ff6347', // Tomato color
      padding: 10,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    favoriteButtonText: {
      color: '#fff',
      marginLeft: 5,
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
  
  export default PopularGrid;
  