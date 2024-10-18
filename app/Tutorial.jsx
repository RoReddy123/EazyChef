import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router'; // Correct hook import
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../configs/FirebaseConfig'; // Adjust path as needed
import BackArrow from '../components/BackArrow'; // Adjust path as needed

const Item1Screen = () => {
    const router = useRouter();
    const [mealPlans, setMealPlans] = useState([]);
    const [articles, setArticles] = useState([]);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const mealPlanSnapshot = await getDocs(collection(db, 'NutriMealPlan'));
                const articleSnapshot = await getDocs(collection(db, 'NutriArticles'));
                const videoSnapshot = await getDocs(collection(db, 'NutriVideos'));

                const mealPlansData = mealPlanSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                const articlesData = articleSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                const videosData = videoSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                setMealPlans(mealPlansData);
                setArticles(articlesData);
                setVideos(videosData);
            } catch (error) {
                console.error("Error fetching data: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handlePress = (route) => {
        router.navigate(route); // Navigate to specific details
    };

    if (loading) {
        return <ActivityIndicator size="large" color="#0000ff" />;
    }

    return (
        <View style={styles.container}>
            {/* Container for Back Arrow and Title Text */}
            <View style={styles.header}>
                {/* Back Arrow component to navigate back */}
                <BackArrow onPress={() => router.back()} />
                
                {/* Title Text for "Tutorial" */}
                <Text style={styles.title}>Tutorial</Text>
            </View>

            {/* Section Title for Meal Plans */}
            <Text style={styles.sectionTitle}>Meal Plans</Text>

            <View style={styles.grid}>
              {mealPlans.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  onPress={() => handlePress(item.route)}
                >
                  <Image source={{ uri: item.image }} style={styles.cardImage} />
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.title}>{item.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Section Title for Articles */}
            <Text style={styles.sectionTitle}>Nutri Articles</Text>
            <FlatList
                data={articles}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.articleCard} onPress={() => handlePress(item.route)}>
                        <Image source={{ uri: item.image }} style={styles.articleImage} />
                        <Text style={styles.articleTitle}>{item.title}</Text>
                    </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.articlesContainer}
            />

            {/* Section Title for Videos */}
            <Text style={styles.sectionTitle}>Nutri Videos</Text>
            <FlatList
                data={videos}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.articleCard} onPress={() => handlePress(item.route)}>
                        <Image source={{ uri: item.image }} style={styles.articleImage} />
                        <Text style={styles.articleTitle}>{item.title}</Text>
                    </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.articlesContainer}
            />
        </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: 0, // Set horizontal padding to 0
    paddingTop: 30, // Maintain top padding if needed
    paddingBottom: 30, // Maintain bottom padding if needed
  },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginLeft: 10,
        color: '#000',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
        marginLeft: 15,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start', // Align items to the start
      marginHorizontal: 20,
  },
  
    card: {
      width: '48%', // Increase width to fit without margins
      marginBottom: 20,
      marginHorizontal: '1%', // Optionally add a small horizontal margin
      backgroundColor: 'white',
      borderRadius: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 5,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'flex-start',
  },
    cardImage: {
        width: '100%',
        height: 100,
    },
    cardTitleContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
    },
    articlesContainer: {
        paddingVertical: 10,
        paddingLeft: 15,
    },
    articleCard: {
        width: 150, // Fixed width for articles and videos
        height: 135,
        marginRight: 15,
        backgroundColor: 'white',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    articleImage: {
        width: '100%',
        height: 100,
    },
    articleTitle: {
        padding: 5,
        textAlign: 'center',
        fontSize: 14,
    },
});

export default Item1Screen;
