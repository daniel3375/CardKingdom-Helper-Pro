import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'screens/order_detail_screen.dart';
import 'models/purchases_models.dart';
import 'services/firestore_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(const ManaBrosApp());
}

class ManaBrosApp extends StatelessWidget {
  const ManaBrosApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ManaBros',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0D1117),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFFBBF24),
          surface: Color(0xFF161B22),
        ),
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator(color: Color(0xFFFBBF24))),
          );
        }

        final user = snapshot.data;
        if (user == null) {
          return Scaffold(
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.shield_rounded, size: 64, color: Color(0xFFFBBF24)),
                  const SizedBox(height: 16),
                  const Text('ManaBros Consolidador', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.login),
                    label: const Text('Iniciar Sesión con Google'),
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFBBF24), foregroundColor: Colors.black),
                    onPressed: () {
                      // Login flow con GoogleSignIn
                    },
                  ),
                ],
              ),
            ),
          );
        }

        return FutureBuilder<UserProfile?>(
          future: FirestoreService().getUserProfile(user.uid),
          builder: (context, userSnap) {
            final profile = userSnap.data;
            final isAdmin = profile?.isAdmin ?? false;

            return FutureBuilder<PurchaseOrder?>(
              future: FirestoreService().getActiveOrder(),
              builder: (context, orderSnap) {
                if (orderSnap.connectionState == ConnectionState.waiting) {
                  return const Scaffold(
                    body: Center(child: CircularProgressIndicator(color: Color(0xFFFBBF24))),
                  );
                }

                final activeOrder = orderSnap.data;
                if (activeOrder == null) {
                  return Scaffold(
                    body: Center(
                      child: Text('No hay orden activa en este momento', style: TextStyle(color: Colors.white70)),
                    ),
                  );
                }

                return OrderDetailScreen(
                  orderId: activeOrder.id,
                  isAdmin: isAdmin,
                  currentUserEmail: user.email ?? '',
                );
              },
            );
          },
        );
      },
    );
  }
}
