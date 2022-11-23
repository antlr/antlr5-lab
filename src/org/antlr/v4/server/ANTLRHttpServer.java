package org.antlr.v4.server;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.antlr.v4.server.persistence.PersistenceLayer;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.eclipse.jetty.servlet.DefaultServlet;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.util.URIUtil;
import org.eclipse.jetty.util.resource.PathResource;
import org.eclipse.jetty.util.thread.QueuedThreadPool;


import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public class ANTLRHttpServer {
	public static final String IMAGES_DIR = "/tmp/antlr-images";
	public static final int UUID_LEN = 36;

	public static final PersistenceLayer<String> persistenceLayer = PersistenceLayer.newInstance("local");

	public static class RouterServlet extends DefaultServlet {
		@Override
		protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
			String path = request.getPathInfo();
			path = path.substring(1); // remove '/' on front
			if ( path.length()== UUID_LEN ) {
				System.out.printf("UUID "+path);
				// Redirect to the usual "/" ULR (index.html) with ?uuid=UUID
				response.sendRedirect("/?uuid="+path);
			}
			else {
				super.doGet(request, response);
			}
		}
	}

	public static void main(String[] args) throws Exception {
		new File(IMAGES_DIR).mkdirs();

		Files.createDirectories(Path.of("/var/log/antlrlab"));
		QueuedThreadPool threadPool = new QueuedThreadPool();
		threadPool.setMaxThreads(10);
		threadPool.setName("server");

		Server server = new Server(threadPool);

		ServerConnector http = new ServerConnector(server);
		http.setPort(80);

		server.addConnector(http);

//		Server server = new Server(8080);

		ServletContextHandler context = new ServletContextHandler(ServletContextHandler.SESSIONS);
		context.setContextPath("/");
		context.setBaseResource(new PathResource(Paths.get("static")));
		context.addServlet(RouterServlet.class, "/*");
		context.addServlet(ParseServlet.class, "/parse/*");
		context.addServlet(ShareServlet.class, "/share/*");
		context.addServlet(LoadServlet.class, "/load/*");
		server.setHandler(context);

		server.start();
	}
}
